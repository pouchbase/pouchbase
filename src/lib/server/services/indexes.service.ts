import type { ContextError, ServiceError } from './base.service';
import type { CollectionLookupError } from './collections.service';
import type { Field } from './fields.service';
import type { ResultAsync } from 'neverthrow';

import { queryDatabase } from '../db/query';
import { uniqueIndexName } from '../fields/ddl';
import { Service } from './base.service';

export type CollectionIndex = {
	name: string;
	columns: string[];
	unique: boolean;
	/** Name of the field that owns this index (a field marked "Unique"); `null` for custom indexes. */
	managedBy: string | null;
};

export type IndexInput = {
	columns: string[];
	unique: boolean;
};

export type IndexesError =
	| ContextError
	| CollectionLookupError
	| ServiceError<9000, 'INDEXES_FAILED'>
	| ServiceError<9001, 'INVALID_INDEX_COLUMNS'>
	| ServiceError<9002, 'DUPLICATE_VALUES'>
	| ServiceError<9004, 'INDEX_NOT_FOUND'>;

const MAX_COLUMNS = 8;
const NAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Custom indexes are named `ix_<random>`; index names are unique per database. */
function randomIndexName() {
	const bytes = crypto.getRandomValues(new Uint8Array(12));

	return `ix_${Array.from(bytes, (byte) => NAME_ALPHABET[byte % NAME_ALPHABET.length]).join('')}`;
}

/** Groups the pragma rows per index and marks the ones owned by a "Unique" field. */
function toIndexes(rows: unknown[][], collectionFields: Field[]) {
	const owners = new Map(collectionFields.map((field) => [uniqueIndexName(field), field.name]));
	const indexes = new Map<string, CollectionIndex>();

	for (const [name, unique, column] of rows) {
		const key = String(name);
		const index = indexes.get(key) ?? {
			name: key,
			columns: [],
			unique: Number(unique) === 1,
			managedBy: owners.get(key) ?? null
		};

		index.columns.push(String(column));
		indexes.set(key, index);
	}

	return [...indexes.values()];
}

/** One row per indexed column: `[index name, unique, column]`, from SQLite's pragmas. */
async function readIndexes(databaseId: string, tableName: string, collectionFields: Field[]) {
	const rows = await queryDatabase(
		databaseId,
		`SELECT il.name, il."unique", ii.name FROM pragma_index_list(?) AS il JOIN pragma_index_info(il.name) AS ii WHERE il.origin != 'pk' ORDER BY il.name, ii.seqno`,
		[tableName]
	);

	return toIndexes(rows, collectionFields);
}

/** The custom indexes of a collection's table; the unique indexes of fields belong to the fields. */
export class IndexesService extends Service {
	/** The indexes of a collection's table, read from the app database itself. */
	list(collectionName: string): ResultAsync<CollectionIndex[], IndexesError> {
		return this.run(async () => {
			const { collection, fields, databaseId } = await this.context(collectionName);

			return readIndexes(databaseId, collection.name, fields);
		}, this.failed);
	}

	create(collectionName: string, input: IndexInput): ResultAsync<CollectionIndex, IndexesError> {
		return this.run(async () => {
			const { collection, fields, databaseId } = await this.context(collectionName);

			return this.createIndex(databaseId, collection.name, fields, input);
		}, this.failed);
	}

	/**
	 * Changes the columns or uniqueness of a custom index. SQLite can't alter an index, so a new
	 * one is created first and the old one is dropped after; if creating fails, nothing changes.
	 */
	update(
		collectionName: string,
		name: string,
		input: IndexInput
	): ResultAsync<CollectionIndex, IndexesError> {
		return this.run(async () => {
			const { collection, fields, databaseId } = await this.context(collectionName);
			const index = await this.requireCustom(databaseId, collection.name, fields, name);
			const created = await this.createIndex(databaseId, collection.name, fields, input);

			try {
				await queryDatabase(databaseId, `DROP INDEX "${index.name}"`);
			} catch (error) {
				// Keep a single index: remove the new one again when the old one stays.
				await queryDatabase(databaseId, `DROP INDEX "${created.name}"`).catch(() => undefined);
				throw error;
			}

			return created;
		}, this.failed);
	}

	/** Drops a custom index. Indexes owned by a "Unique" field are removed through that field. */
	delete(collectionName: string, name: string): ResultAsync<void, IndexesError> {
		return this.run(async () => {
			const { collection, fields, databaseId } = await this.context(collectionName);
			const index = await this.requireCustom(databaseId, collection.name, fields, name);

			await queryDatabase(databaseId, `DROP INDEX "${index.name}"`);
		}, this.failed);
	}

	/** The collection, its fields and the app database. */
	private async context(collectionName: string) {
		const [{ collection, fields }, appDatabase] = await Promise.all([
			this.must(this.services.collections().requireWithFields(collectionName)),
			this.must(this.services.database().requireApp())
		]);

		return { collection, fields, databaseId: appDatabase.id };
	}

	/** Creates an index on known columns only, since column names end up in SQL. */
	private async createIndex(
		databaseId: string,
		tableName: string,
		collectionFields: Field[],
		input: IndexInput
	): Promise<CollectionIndex> {
		const columns = [...new Set(input.columns)];
		// Every field except blobs can be indexed.
		const allowed = new Set(
			collectionFields.filter((field) => field.type !== 'blob').map((field) => field.name)
		);

		if (
			!columns.length ||
			columns.length > MAX_COLUMNS ||
			!columns.every((column) => allowed.has(column))
		) {
			this.fail(9001, 'INVALID_INDEX_COLUMNS');
		}

		const name = randomIndexName();

		try {
			await queryDatabase(
				databaseId,
				`CREATE ${input.unique ? 'UNIQUE ' : ''}INDEX "${name}" ON "${tableName}" (${columns.map((column) => `"${column}"`).join(', ')})`
			);
		} catch (error) {
			if (
				String(error instanceof Error ? error.message : error).includes('UNIQUE constraint failed')
			) {
				this.fail(9002, 'DUPLICATE_VALUES', { cause: error });
			}

			throw error;
		}

		return { name, columns, unique: input.unique, managedBy: null };
	}

	/** A custom index by name; indexes owned by a "Unique" field are changed through that field. */
	private async requireCustom(
		databaseId: string,
		tableName: string,
		collectionFields: Field[],
		name: string
	) {
		const indexes = await readIndexes(databaseId, tableName, collectionFields);
		const found = indexes.find((candidate) => candidate.name === name);

		if (!found || found.managedBy) {
			this.fail(9004, 'INDEX_NOT_FOUND');
		}

		return found;
	}

	private readonly failed = (error: unknown) => this.error(9000, 'INDEXES_FAILED', error);
}
