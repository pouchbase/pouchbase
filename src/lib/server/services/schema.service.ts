import type { ImportProblem } from '#lib/collections/transfer.js';
import type { Plan } from '#lib/environments/diff.js';
import type {
	ApiCreateCollection,
	ApiUpdateCollection,
	CollectionExport
} from '#lib/schemas/collections.js';
import type { SnapshotCollection } from '#lib/schemas/environments.js';
import type { ErrorOf, ServiceError } from './base.service';
import type { EnvironmentsService } from './environments.service';
import type { PluginsService } from './plugins.service';
import type { ResultAsync } from 'neverthrow';

import { exportCollections, planImport } from '#lib/collections/transfer.js';
import { planSeverity } from '#lib/environments/diff.js';
import { COLLECTION_EXPORT_FORMAT, isValidCollectionName } from '#lib/schemas/collections.js';

import { Service } from './base.service';

export type SchemaError =
	| ErrorOf<ReturnType<EnvironmentsService['collections']>>
	| ErrorOf<ReturnType<EnvironmentsService['runSteps']>>
	| ErrorOf<ReturnType<PluginsService['fieldTypes']>>
	| ServiceError<6000, 'COLLECTIONS_FAILED'>
	| ServiceError<6002, 'INVALID_COLLECTION_NAME'>
	| ServiceError<6003, 'COLLECTION_ALREADY_EXISTS'>
	| ServiceError<6006, 'COLLECTION_NOT_FOUND'>
	| ServiceError<6011, 'SYSTEM_COLLECTION'>
	/** Relation fields of the file point at collections this instance doesn't have. */
	| (ServiceError<6015, 'INVALID_IMPORT'> & { data: { problems: ImportProblem[] } })
	/** The plan deletes collections, fields or their data, and that wasn't confirmed. */
	| (ServiceError<6016, 'DESTRUCTIVE_NOT_CONFIRMED'> & { data: { plan: Plan } });

export type ImportOptions = {
	/** Also delete the collections the file doesn't have (built-in collections stay). */
	removeMissing: boolean;
	/** Run a plan that deletes collections, fields or their data. */
	force: boolean;
	/** Only make the plan. */
	dryRun: boolean;
};

/** An import: its plan, and whether it ran. */
export type ImportResult = { plan: Plan; applied: boolean };

type CollectionInput = Required<Pick<ApiUpdateCollection, 'fields' | 'indexes' | 'rules'>> &
	Pick<ApiUpdateCollection, 'thumbnails'>;

/** A collection as the collections API takes it, as a collection of an export file. */
function toSnapshot(
	id: string,
	name: string,
	input: CollectionInput,
	existing: SnapshotCollection | null
): SnapshotCollection {
	return {
		id,
		name,
		system: existing?.system ?? false,
		settings: {
			...existing?.settings,
			rules: { ...existing?.settings.rules, ...input.rules },
			...(input.thumbnails && { thumbnails: input.thumbnails })
		},
		fields: input.fields.map((field, position) => {
			// A field without an id is the existing field with its name, or a new one.
			const current = existing?.fields.find((candidate) =>
				field.id ? candidate.id === field.id : candidate.name === field.name
			);

			return {
				id: field.id ?? current?.id ?? crypto.randomUUID(),
				name: field.name,
				type: field.type,
				required: field.required,
				unique: field.unique,
				hidden: field.hidden,
				defaultValue: field.defaultValue,
				options: field.options,
				system: current?.system ?? false,
				position
			};
		}),
		indexes: input.indexes.map((index) => ({ name: '', ...index }))
	};
}

/** An export file with these collections, as `import` takes it. */
function exportFile(collections: SnapshotCollection[]): CollectionExport {
	return {
		format: COLLECTION_EXPORT_FORMAT,
		exportedAt: new Date().toISOString(),
		collections,
		related: []
	};
}

/** The input of a `PATCH`: the given parts over the existing collection. */
function patched(existing: SnapshotCollection, input: ApiUpdateCollection): CollectionInput {
	return {
		fields: input.fields ?? existing.fields,
		indexes: input.indexes ?? existing.indexes,
		rules: input.rules ?? {},
		thumbnails: input.thumbnails
	};
}

/**
 * The schema as a whole, as the collections API (`/api/schema`), export files and plugins see it:
 * every collection with its fields, indexes, API rules and settings. Changes are made as a plan
 * of steps (`#lib/environments/diff.js`) that the environments service runs.
 */
export class SchemaService extends Service {
	/** Every collection with its fields, indexes, API rules and settings, by name. */
	schemas(): ResultAsync<SnapshotCollection[], SchemaError> {
		return this.services.environments().collections();
	}

	/** One collection as `schemas` has them; `null` when it doesn't exist. */
	schema(name: string): ResultAsync<SnapshotCollection | null, SchemaError> {
		return this.schemas().map(
			(schemas) => schemas.find((collection) => collection.name === name) ?? null
		);
	}

	/** An export file of every collection, or of the ones in `names`. */
	export(names?: string[]): ResultAsync<CollectionExport, SchemaError> {
		return this.schemas().map((schemas) => exportCollections(schemas, names));
	}

	/**
	 * Creates the collections of an export file and changes the existing ones to match it. A plan
	 * that deletes collections, fields or data only runs with `force`.
	 */
	import(file: CollectionExport, options: ImportOptions): ResultAsync<ImportResult, SchemaError> {
		return this.run(
			async () => this.importInto(file, options, await this.must(this.schemas())),
			this.failed
		);
	}

	/** Creates a collection with its fields, indexes and API rules (`POST /api/schema`). */
	create(input: ApiCreateCollection): ResultAsync<SnapshotCollection, SchemaError> {
		return this.run(async () => {
			if (!isValidCollectionName(input.name)) {
				this.fail(6002, 'INVALID_COLLECTION_NAME');
			}

			const target = await this.must(this.schemas());

			if (target.some((collection) => collection.name === input.name)) {
				this.fail(6003, 'COLLECTION_ALREADY_EXISTS');
			}

			const collection = toSnapshot(crypto.randomUUID(), input.name, input, null);

			await this.importInto(
				exportFile([collection]),
				{ removeMissing: false, force: false, dryRun: false },
				target
			);

			return this.requireSchema(collection.name);
		}, this.failed);
	}

	/**
	 * Changes a collection (`PATCH /api/schema/<name>`): only the given parts. Fields and indexes
	 * left out of a given list are deleted, which needs `force`.
	 */
	update(
		name: string,
		input: ApiUpdateCollection,
		force: boolean
	): ResultAsync<SnapshotCollection, SchemaError> {
		return this.run(async () => {
			const newName = input.name ?? name;

			if (newName !== name && !isValidCollectionName(newName)) {
				this.fail(6002, 'INVALID_COLLECTION_NAME');
			}

			const target = await this.must(this.schemas());
			const existing = target.find((collection) => collection.name === name);

			if (!existing) {
				this.fail(6006, 'COLLECTION_NOT_FOUND');
			}

			if (existing.system && newName !== name) {
				this.fail(6011, 'SYSTEM_COLLECTION');
			}

			const collection = toSnapshot(existing.id, newName, patched(existing, input), existing);

			await this.importInto(
				exportFile([collection]),
				{ removeMissing: false, force, dryRun: false },
				target
			);

			return this.requireSchema(newName);
		}, this.failed);
	}

	/**
	 * Changes several existing collections at once (`update` for each), in one plan on one read of
	 * the schema: a plugin's collections on install and update. Changes nothing when they already
	 * match. A plan that deletes fields or data only runs with `force`.
	 */
	updateMany(
		items: { name: string; input: ApiUpdateCollection }[],
		force: boolean
	): ResultAsync<ImportResult, SchemaError> {
		return this.run(async () => {
			const target = await this.must(this.schemas());
			const collections = items.map(({ name, input }) => {
				const existing = target.find((collection) => collection.name === name);

				if (!existing) {
					this.fail(6006, 'COLLECTION_NOT_FOUND');
				}

				return toSnapshot(existing.id, name, patched(existing, input), existing);
			});

			return this.importInto(
				exportFile(collections),
				{ removeMissing: false, force, dryRun: false },
				target
			);
		}, this.failed);
	}

	/** `import` into `target`, the schema as it is now. */
	private async importInto(
		file: CollectionExport,
		options: ImportOptions,
		target: SnapshotCollection[]
	): Promise<ImportResult> {
		const types = await this.must(this.services.plugins().fieldTypes());
		const planned = planImport(file, target, {
			...options,
			pluginFieldTypes: new Set<string>(types.map((type) => type.id))
		});

		if ('problems' in planned) {
			this.fail(6015, 'INVALID_IMPORT', { data: { problems: planned.problems } });
		}

		const { plan } = planned;

		if (options.dryRun || !plan.steps.length) {
			return { plan, applied: false };
		}

		if (planSeverity(plan) === 'destructive' && !options.force) {
			this.fail(6016, 'DESTRUCTIVE_NOT_CONFIRMED', { data: { plan } });
		}

		await this.must(this.services.environments().runSteps(plan.steps));

		return { plan, applied: true };
	}

	/** The collection as `schemas` has it, after a change. */
	private async requireSchema(name: string) {
		return (await this.must(this.schema(name))) ?? this.fail(6006, 'COLLECTION_NOT_FOUND');
	}

	private readonly failed = (error: unknown) => this.error(6000, 'COLLECTIONS_FAILED', error);
}
