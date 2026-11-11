import type { PluginTypes } from '#lib/fields/declarations.js';
import type { ContextError, ErrorOf, ServiceError } from './base.service';
import type { Field } from './fields.service';
import type { FunctionsService } from './functions.service';
import type { MailTemplatesService } from './mail-templates.service';
import type { PluginsService } from './plugins.service';
import type { ResultAsync } from 'neverthrow';

import { splitPluginFieldType } from '@pouchbasejs/plugin-sdk';
import { asc, inArray } from 'drizzle-orm';

import { declarations } from '#lib/fields/declarations.js';

import { generateToken, hashToken } from '../crypto';
import { collections, fields, plugins } from '../db';
import { hasPluginFields } from '../plugin-fields';
import { Service } from './base.service';

export type TypesError =
	| ContextError
	| ServiceError<5001, 'SET_SETTING_FAILED'>
	| ServiceError<17000, 'TYPES_FAILED'>
	| ErrorOf<ReturnType<FunctionsService['callable' | 'list']>>
	| ErrorOf<ReturnType<MailTemplatesService['sendable']>>
	| ErrorOf<ReturnType<PluginsService['fieldTypes']>>;

/** The TypeScript types of the collections (`#lib/fields/declarations.js`), and the token of `/api/types`. */
export class TypesService extends Service {
	/**
	 * TypeScript declarations of every collection and its fields, the email templates and functions.
	 * `Functions` has the deployed functions; with `undeployed` every created one, for the editor.
	 */
	generate({ undeployed = false }: { undeployed?: boolean } = {}): ResultAsync<string, TypesError> {
		return this.run(
			async () => {
				// One query for the fields of every collection, instead of one per collection.
				const [list, all] = await this.db.batch([
					this.db.select().from(collections).orderBy(asc(collections.name)),
					this.db.select().from(fields).orderBy(asc(fields.position), asc(fields.createdAt))
				]);
				const pluginTypes = await this.pluginTypes(all);
				const templates = await this.must(this.services.mailTemplates().sendable());
				const functions = undeployed
					? await this.must(this.services.functions().list())
					: await this.must(this.services.functions().callable());

				return declarations(list, all, pluginTypes, templates, functions);
			},
			(error) => this.error(17000, 'TYPES_FAILED', error)
		);
	}

	/**
	 * The installed plugin field types, and which of them the API returns deserialized: a type
	 * whose handler has `deserialize`, as the plugin described itself when it was installed.
	 */
	private async pluginTypes(all: Field[]): Promise<PluginTypes> {
		if (!hasPluginFields(all)) {
			return { installed: [], deserializes: new Set() };
		}

		const installed = await this.must(this.services.plugins().fieldTypes());
		const ids = [...new Set(installed.map((type) => type.pluginId))];
		const rows = ids.length
			? await this.db
					.select({ id: plugins.id, capabilities: plugins.capabilities })
					.from(plugins)
					.where(inArray(plugins.id, ids))
			: [];
		const capabilities = new Map(rows.map((row) => [row.id, row.capabilities]));
		const deserializes = new Set(
			installed
				.filter((type) => {
					const handlers = capabilities.get(type.pluginId)?.fieldHandlers;
					const own = splitPluginFieldType(type.id)?.type ?? type.type;

					return !!handlers && Object.hasOwn(handlers, own) && handlers[own].deserialize;
				})
				.map((type) => type.id)
		);

		return { installed, deserializes };
	}

	/** The secret that `GET /api/types` asks for; created the first time it is needed. */
	token(): ResultAsync<string, TypesError> {
		return this.run(
			async () =>
				(await this.must(this.services.settings().get('types_token'))) ||
				(await this.must(this.regenerateToken())),
			(error) => this.error(17000, 'TYPES_FAILED', error)
		);
	}

	/** Replaces the token, so URLs with the old one stop working. */
	regenerateToken(): ResultAsync<string, TypesError> {
		return this.run(
			async () => {
				const token = generateToken();

				await this.must(this.services.settings().set('types_token', token));

				return token;
			},
			(error) => this.error(17000, 'TYPES_FAILED', error)
		);
	}

	/** Whether `token` is the current token. There is none until an admin opens the types page. */
	verifyToken(token: string): ResultAsync<boolean, TypesError> {
		return this.run(
			async () => {
				const current = await this.must(this.services.settings().get('types_token'));

				if (!current) {
					return false;
				}

				// Compares hashes, so the time it takes says nothing about the token.
				const [given, expected] = await Promise.all([hashToken(token), hashToken(current)]);

				return given === expected;
			},
			(error) => this.error(17000, 'TYPES_FAILED', error)
		);
	}
}
