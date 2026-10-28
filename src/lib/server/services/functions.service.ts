import type { ApiKeysService } from './api-keys.service';
import type { AppUser } from './auth.service';
import type { ErrorOf, ServiceError } from './base.service';
import type { FunctionRequest, FunctionResponse, FunctionRow } from './functions-worker';
import type { FunctionLog } from '../platform';
import type { ResultAsync } from 'neverthrow';

import { desc, eq, max } from 'drizzle-orm';

import type { FunctionLanguage } from '#lib/functions/functions.js';

import { functionTemplate, MAX_CODE_SIZE, RESERVED_ENV_NAMES } from '#lib/functions/functions.js';

import { generateToken } from '../crypto';
import { functions, functionVersions } from '../db';
import { scriptName } from '../functions';
import { functions as driver, PlatformError } from '../platform';
import { Service } from './base.service';
import { describeError } from '../errors';
import { testReason, testWorker, uploadWorker, workerRequest } from './functions-worker';

/**
 * Serverless functions: code written or uploaded on the Functions page that runs as a Worker of
 * its own (`<instance>-fn-<name>`) on the Cloudflare account. Every deploy is kept as a version;
 * secrets live only on the Worker. Apps call a function through `/api/functions/<name>`, which
 * forwards the request to the Worker (see `../functions.ts`).
 */

/** A function as the Functions pages show it; the shared secret stays on the server. */
export type FunctionInfo = {
	id: string;
	name: string;
	description: string;
	requireAuth: boolean;
	/** Whether the function has been deployed (it is, unless the first deploy failed). */
	deployed: boolean;
	/** Number of the version that runs, `null` before the first deploy. */
	version: number | null;
	language: FunctionLanguage | null;
	createdAt: Date;
	updatedAt: Date;
};

export type FunctionDetail = FunctionInfo & {
	/** Code of the version that runs; the starter code before the first deploy. */
	source: string;
};

export type FunctionVersion = {
	id: string;
	number: number;
	language: FunctionLanguage;
	/** Bytes of the source. */
	size: number;
	createdAt: Date;
};

export type FunctionCode = {
	language: FunctionLanguage;
	source: string;
	/** JavaScript compiled from TypeScript (in the browser); omitted for JavaScript. */
	compiled?: string;
};

export type FunctionsError =
	| ErrorOf<ReturnType<ApiKeysService['issueFunctionKey']>>
	| ServiceError<18000, 'FUNCTIONS_FAILED'>
	| ServiceError<18001, 'FUNCTION_NOT_FOUND'>
	| ServiceError<18002, 'FUNCTION_NAME_TAKEN'>
	| ServiceError<18003, 'CODE_TOO_LARGE'>
	| ServiceError<18004, 'NO_WORKERS_SUBDOMAIN'>
	| (ServiceError<18005, 'DEPLOY_FAILED'> & { data: { reason: string } })
	| ServiceError<18006, 'DELETE_FUNCTION_FAILED'>
	| ServiceError<18007, 'VERSION_NOT_FOUND'>
	| (ServiceError<18008, 'SECRETS_FAILED'> & { data: { reason: string } })
	| ServiceError<18009, 'FUNCTION_NOT_DEPLOYED'>
	| ServiceError<18011, 'LOGS_FORBIDDEN'>
	| (ServiceError<18012, 'INVOKE_FAILED'> & { data: { reason: string } });

function byteLength(value: string) {
	return new TextEncoder().encode(value).byteLength;
}

type VersionSummary = Pick<typeof functionVersions.$inferSelect, 'number' | 'language'>;

function info(row: FunctionRow, version: VersionSummary | null): FunctionInfo {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		requireAuth: row.requireAuth,
		deployed: !!row.url && !!version,
		version: version?.number ?? null,
		language: version?.language ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function versionInfo(version: typeof functionVersions.$inferSelect): FunctionVersion {
	return {
		id: version.id,
		number: version.number,
		language: version.language,
		size: byteLength(version.source),
		createdAt: version.createdAt
	};
}

export class FunctionsService extends Service {
	/** Every function with the version that runs, by name. */
	list(): ResultAsync<FunctionInfo[], FunctionsError> {
		return this.run(async () => {
			const [rows, versions] = await Promise.all([
				this.db.select().from(functions).orderBy(functions.name),
				this.db
					.select({
						functionId: functionVersions.functionId,
						number: functionVersions.number,
						language: functionVersions.language
					})
					.from(functionVersions)
			]);
			const latest = new Map<string, VersionSummary>();

			for (const version of versions) {
				if (version.number > (latest.get(version.functionId)?.number ?? 0)) {
					latest.set(version.functionId, version);
				}
			}

			return rows.map((row) => info(row, latest.get(row.id) ?? null));
		}, this.failed);
	}

	/** The function with this name and the code that runs, or `null`. */
	get(name: string): ResultAsync<FunctionDetail | null, FunctionsError> {
		return this.run(async () => {
			const row = await this.findRow(name);

			if (!row) {
				return null;
			}

			const [version] = await this.db
				.select()
				.from(functionVersions)
				.where(eq(functionVersions.functionId, row.id))
				.orderBy(desc(functionVersions.number))
				.limit(1);

			return {
				...info(row, version ?? null),
				source: version?.source ?? functionTemplate('typescript')
			};
		}, this.failed);
	}

	/** Creates the function and deploys the starter code, so its Worker exists right away. */
	create(input: {
		name: string;
		description: string;
		requireAuth: boolean;
		language: FunctionLanguage;
	}): ResultAsync<FunctionInfo, FunctionsError> {
		return this.run(async () => {
			if (await this.findRow(input.name)) {
				this.fail(18002, 'FUNCTION_NAME_TAKEN');
			}

			const [row] = await this.db
				.insert(functions)
				.values({
					name: input.name,
					description: input.description,
					requireAuth: input.requireAuth,
					secret: generateToken()
				})
				.returning();

			// Keeps the function when the deploy fails: the code can be fixed and deployed again.
			const version = await this.deployCode(row, {
				language: input.language,
				source: functionTemplate(input.language)
			});

			return info(row, version);
		}, this.failed);
	}

	/** Changes the description and who may call the function; takes effect right away. */
	update(
		id: string,
		input: { description: string; requireAuth: boolean }
	): ResultAsync<void, FunctionsError> {
		return this.run(async () => {
			const rows = await this.db
				.update(functions)
				.set({ ...input, updatedAt: new Date() })
				.where(eq(functions.id, id))
				.returning({ id: functions.id });

			if (!rows.length) {
				this.fail(18001, 'FUNCTION_NOT_FOUND');
			}
		}, this.failed);
	}

	/** Deploys the code as a new version. */
	deploy(id: string, code: FunctionCode): ResultAsync<FunctionVersion, FunctionsError> {
		return this.run(async () => {
			const row = await this.requireRow(id);

			return versionInfo(await this.deployCode(row, code));
		}, this.failed);
	}

	/** Deploys the code of an earlier version again, as a new version. */
	restore(id: string, versionId: string): ResultAsync<FunctionVersion, FunctionsError> {
		return this.run(async () => {
			const row = await this.requireRow(id);
			const [version] = await this.db
				.select()
				.from(functionVersions)
				.where(eq(functionVersions.id, versionId));

			if (!version || version.functionId !== row.id) {
				this.fail(18007, 'VERSION_NOT_FOUND');
			}

			const deployed = await this.deployCode(row, {
				language: version.language,
				source: version.source,
				compiled: version.compiled ?? undefined
			});

			return versionInfo(deployed);
		}, this.failed);
	}

	/** Every deployed version, newest first. */
	versions(id: string): ResultAsync<FunctionVersion[], FunctionsError> {
		return this.run(async () => {
			const rows = await this.db
				.select()
				.from(functionVersions)
				.where(eq(functionVersions.functionId, id))
				.orderBy(desc(functionVersions.number));

			return rows.map(versionInfo);
		}, this.failed);
	}

	/** The source of a version, to look at before restoring it; `null` when it doesn't exist. */
	versionSource(
		id: string,
		versionId: string
	): ResultAsync<{ language: FunctionLanguage; source: string } | null, FunctionsError> {
		return this.run(async () => {
			const [version] = await this.db
				.select()
				.from(functionVersions)
				.where(eq(functionVersions.id, versionId));

			return version?.functionId === id
				? { language: version.language, source: version.source }
				: null;
		}, this.failed);
	}

	/** Deletes the Worker (with its secrets), then the function and its versions. */
	delete(id: string): ResultAsync<void, FunctionsError> {
		return this.run(async () => {
			const row = await this.requireRow(id);

			try {
				await driver.delete(scriptName(row.name));
			} catch (error) {
				this.fail(18006, 'DELETE_FUNCTION_FAILED', { cause: error });
			}

			await this.db.delete(functions).where(eq(functions.id, id));
		}, this.failed);
	}

	/** Names of the function's secrets; their values can't be read back. */
	secrets(id: string): ResultAsync<string[], FunctionsError> {
		return this.run(async () => {
			const row = await this.requireRow(id);
			const names = await driver
				.secrets(scriptName(row.name))
				.catch((error: unknown) => this.secretsFailed(error));

			return names.filter((name) => !RESERVED_ENV_NAMES.includes(name));
		}, this.failed);
	}

	/** Adds or replaces a secret; the Worker gets a new version with it. */
	setSecret(id: string, name: string, value: string): ResultAsync<void, FunctionsError> {
		return this.run(async () => {
			const row = await this.requireDeployed(id);

			await driver
				.putSecret(scriptName(row.name), name, value)
				.catch((error: unknown) => this.secretsFailed(error));
		}, this.failed);
	}

	deleteSecret(id: string, name: string): ResultAsync<void, FunctionsError> {
		return this.run(async () => {
			const row = await this.requireRow(id);

			await driver
				.deleteSecret(scriptName(row.name), name)
				.catch((error: unknown) => this.secretsFailed(error));
		}, this.failed);
	}

	/** Log lines of the last `hours`, newest first. Needs Workers Observability on the token. */
	logs(id: string, hours: number): ResultAsync<FunctionLog[], FunctionsError> {
		return this.run(async () => {
			const row = await this.requireRow(id);

			try {
				return await driver.logs(scriptName(row.name), Date.now() - hours * 60 * 60 * 1000);
			} catch (error) {
				if (error instanceof PlatformError && (error.status === 401 || error.status === 403)) {
					this.fail(18011, 'LOGS_FORBIDDEN', { cause: error });
				}

				throw error;
			}
		}, this.failed);
	}

	/**
	 * The function with this name as the public API needs it: whether callers must be signed in.
	 * `null` when it doesn't exist or isn't deployed.
	 */
	findPublic(name: string): ResultAsync<{ requireAuth: boolean } | null, FunctionsError> {
		return this.run(async () => {
			const row = await this.findRow(name);

			return row?.url ? { requireAuth: row.requireAuth } : null;
		}, this.failed);
	}

	/**
	 * Forwards a request to the function's Worker, as `user` (or anonymously), and returns its
	 * response. Who may call the function is checked by the caller.
	 */
	invoke(
		name: string,
		request: Request,
		path: string,
		user: AppUser | null
	): ResultAsync<Response, FunctionsError> {
		return this.run(async () => {
			const row = await this.findRow(name);

			if (!row) {
				this.fail(18001, 'FUNCTION_NOT_FOUND');
			}

			if (!row.url) {
				this.fail(18009, 'FUNCTION_NOT_DEPLOYED');
			}

			const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

			try {
				return await fetch(workerRequest(row, path, request.method, request.headers, user), {
					body: hasBody ? request.body : null,
					// Node's fetch needs this for a streamed body.
					...(hasBody ? { duplex: 'half' } : {})
				} as RequestInit);
			} catch (error) {
				this.invokeFailed(error, describeError(error));
			}
		}, this.failed);
	}

	/** Sends a request from the test panel, without a user, and reads the whole response. */
	test(id: string, input: FunctionRequest): ResultAsync<FunctionResponse, FunctionsError> {
		return this.run(async () => {
			const row = await this.requireDeployed(id);

			try {
				return await testWorker(row, input);
			} catch (error) {
				this.invokeFailed(error, testReason(error));
			}
		}, this.failed);
	}

	private failed = (error: unknown) => this.error(18000, 'FUNCTIONS_FAILED', error);

	/** Uploads the code to the Worker and stores it as the next version. */
	private async deployCode(row: FunctionRow, code: FunctionCode) {
		const compiled = code.language === 'typescript' ? (code.compiled ?? null) : null;
		const script = scriptName(row.name);

		if (byteLength(code.source) + byteLength(compiled ?? '') > MAX_CODE_SIZE) {
			this.fail(18003, 'CODE_TOO_LARGE');
		}

		if (code.language === 'typescript' && compiled === null) {
			this.fail(18005, 'DEPLOY_FAILED', {
				data: { reason: 'TypeScript code needs the compiled JavaScript' }
			});
		}

		const subdomain = await driver.subdomain().catch((error: unknown) => this.deployFailed(error));

		if (!subdomain) {
			this.fail(18004, 'NO_WORKERS_SUBDOMAIN');
		}

		const [latest] = await this.db
			.select({ number: max(functionVersions.number) })
			.from(functionVersions)
			.where(eq(functionVersions.functionId, row.id));
		const number = (latest?.number ?? 0) + 1;
		const apiKeys = this.services.apiKeys();
		const apiKey = await this.must(apiKeys.issueFunctionKey(row.id, row.name));

		try {
			await uploadWorker(row, {
				code: compiled ?? code.source,
				number,
				origin: this.ctx.url.origin,
				apiKey: apiKey.key
			});
		} catch (error) {
			// The key of a version that didn't deploy is of no use.
			await this.must(apiKeys.deleteFunctionKey(apiKey.id));
			this.deployFailed(error);
		}

		const url = `https://${script}.${subdomain}.workers.dev`;
		const now = new Date();
		const [[version]] = await this.db.batch([
			this.db
				.insert(functionVersions)
				.values({
					functionId: row.id,
					number,
					language: code.language,
					source: code.source,
					compiled,
					createdAt: now
				})
				.returning(),
			this.db.update(functions).set({ url, updatedAt: now }).where(eq(functions.id, row.id))
		]);

		row.url = url;
		row.updatedAt = now;

		// The new version runs with the new key, so the older keys stop working.
		const kept = await apiKeys.keepFunctionKey(row.id, apiKey.id);

		if (kept.isErr()) {
			console.error(`[functions] could not remove old API keys of ${row.name}`, kept.error);
		}

		return version;
	}

	private async findRow(name: string): Promise<FunctionRow | null> {
		const [row] = await this.db.select().from(functions).where(eq(functions.name, name));

		return row ?? null;
	}

	private async requireRow(id: string): Promise<FunctionRow> {
		const [row] = await this.db.select().from(functions).where(eq(functions.id, id));

		if (!row) {
			this.fail(18001, 'FUNCTION_NOT_FOUND');
		}

		return row;
	}

	private async requireDeployed(id: string): Promise<FunctionRow> {
		const row = await this.requireRow(id);

		if (!row.url) {
			this.fail(18009, 'FUNCTION_NOT_DEPLOYED');
		}

		return row;
	}

	private deployFailed(error: unknown): never {
		this.fail(18005, 'DEPLOY_FAILED', { cause: error, data: { reason: describeError(error) } });
	}

	private secretsFailed(error: unknown): never {
		this.fail(18008, 'SECRETS_FAILED', { cause: error, data: { reason: describeError(error) } });
	}

	private invokeFailed(error: unknown, reason: string): never {
		this.fail(18012, 'INVOKE_FAILED', { cause: error, data: { reason } });
	}
}
