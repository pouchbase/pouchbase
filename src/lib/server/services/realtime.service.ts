import type { ResultAsync } from 'neverthrow';
import type { ApiKeysService } from './api-keys.service';
import type { AuthService } from './auth.service';
import type { Collection, CollectionLookupError } from './collections.service';
import type { Field } from './fields.service';
import type { ApiAccess, ApiRecord } from './records.service';
import type { AuthorizeCheck } from '../realtime/authorize';
import type {
	AccessContext,
	AuthorizeResult,
	RecordEvent,
	SessionResult,
	Subject
} from '../realtime/hub-core';
import type { ContextError, ErrorOf, ServiceError } from './base.service';

import { decodeJwt } from 'jose';

import { apiActions } from '#lib/filter/rules.js';

import { batchDatabase } from '../db/query';
import { usesRelations } from '../filter';
import { authorizationChecks } from '../realtime/authorize';
import { publish } from '../realtime/broker';
import { relatedCollections } from '../records/access';
import { apiFields, apiRecord } from '../records/values';
import { API_KEY_PREFIX } from './api-keys.service';
import { Failure, Service } from './base.service';

/** What the hub asks before it adds a subscription. */
export type SubscriptionRequest = {
	collection: string;
	subject: Subject;
	record: string | null;
	filter: string | null;
	fields: string[] | null;
	expand: string[] | null;
};

/** What the hub asks when its collection has events for subscribers. */
export type AuthorizeRequest = {
	collection: string;
	items: { event: RecordEvent; contexts: AccessContext[] }[];
};

type SubscriptionParam = 'where' | 'select' | 'include';

/** Every error of the realtime service; the internal routes map the codes for the hubs. */
export type RealtimeError =
	| ContextError
	| CollectionLookupError
	| ErrorOf<ReturnType<AuthService['verifyToken']>>
	| ErrorOf<ReturnType<ApiKeysService['verify']>>
	| ServiceError<22000, 'PUBLISH_FAILED'>
	| ServiceError<22001, 'SESSION_FAILED'>
	| ServiceError<22002, 'SUBSCRIPTION_FORBIDDEN'>
	| (ServiceError<22003, 'INVALID_SUBSCRIPTION'> & {
			data: { param: SubscriptionParam; message: string };
	  })
	| ServiceError<22004, 'AUTHORIZE_FAILED'>
	| ServiceError<22005, 'INVALID_API_KEY'>
	| ServiceError<22006, 'PLUGIN_KEY'>;

/** What the records API checks for `subject`: nothing for admins (the dashboard). */
function apiAccess(subject: Subject): ApiAccess | undefined {
	if (subject.kind === 'admin') {
		return undefined;
	}

	return { user: subject.kind === 'user' ? subject.auth : null };
}

/**
 * Realtime events of records (see `src/lib/server/realtime/`). The hubs hold the sockets; this
 * service answers what they ask through `/internal/realtime/*`: who a socket is, whether it may
 * subscribe, and who may see an event.
 */
export class RealtimeService extends Service {
	/** Hands saved changes of one collection to its hub. */
	publish(events: RecordEvent[]): ResultAsync<void, RealtimeError> {
		return this.run(
			async () => {
				if (events.length) {
					await publish(events);
				}
			},
			(error) => this.error(22000, 'PUBLISH_FAILED', error)
		);
	}

	/**
	 * Who a socket is: an admin for an API key (`pbk_…`) other than a plugin's, else the app user
	 * of `token`, else the dashboard admin of the session cookie (only passed on when the upgrade
	 * came from the same origin), else anonymous.
	 */
	session(token: string | null): ResultAsync<SessionResult, RealtimeError> {
		return this.run(
			async (): Promise<SessionResult> => {
				if (!token) {
					return {
						subject: this.ctx.locals.user ? { kind: 'admin' } : { kind: 'anonymous' },
						expiresAt: null
					};
				}

				if (token.startsWith(API_KEY_PREFIX)) {
					const key = await this.must(this.services.apiKeys().verify(token));

					if (!key) {
						this.fail(22005, 'INVALID_API_KEY');
					}

					if (key?.pluginId) {
						this.fail(22006, 'PLUGIN_KEY');
					}

					return { subject: { kind: 'admin' }, expiresAt: null };
				}

				const user = await this.must(this.services.auth().verifyToken(token));
				let expiresAt: number | null;

				try {
					const { exp } = decodeJwt(token);
					expiresAt = exp ? exp * 1000 : null;
				} catch (error) {
					return this.fail(11006, 'INVALID_TOKEN', { cause: error });
				}

				return { subject: { kind: 'user', auth: user }, expiresAt };
			},
			(error) => this.error(22001, 'SESSION_FAILED', error)
		);
	}

	/**
	 * Whether `subject` may subscribe: the collection exists, the API offers `view` for it and its
	 * view rule isn't locked or invalid (admins skip the rule), and the filter, fields and `expand`
	 * are valid (see `RecordsService.checkQuery`).
	 */
	checkSubscription(request: SubscriptionRequest): ResultAsync<void, RealtimeError> {
		return this.run(
			async () => {
				const checked = await this.services
					.records()
					.checkQuery(
						request.collection,
						{ where: request.filter, select: request.fields, include: request.expand },
						apiAccess(request.subject)
					);

				if (checked.isOk()) {
					return;
				}

				const { error } = checked;

				if (error.code === 8013 || error.code === 8014 || error.code === 8016) {
					this.fail(22002, 'SUBSCRIPTION_FORBIDDEN');
				}

				if (error.code === 8015) {
					const param = error.data.param === 'order' ? 'where' : error.data.param;

					this.fail(22003, 'INVALID_SUBSCRIPTION', {
						data: {
							param,
							message:
								param === 'include' ? `Invalid include: ${error.data.message}` : error.data.message
						}
					});
				}

				throw new Failure(error);
			},
			(error) => this.error(22004, 'AUTHORIZE_FAILED', error)
		);
	}

	/**
	 * Per event: the record as the API returns it and the contexts allowed to see it, or `null`
	 * when the collection or its table is gone. All checks run in one batch. For allowed contexts
	 * with `expand`, the record with its relations expanded as that subject may see them.
	 */
	authorize(request: AuthorizeRequest): ResultAsync<AuthorizeResult, RealtimeError> {
		return this.run(
			async () => {
				const found = await this.services.collections().requireWithFields(request.collection);

				if (found.isErr()) {
					if (found.error.code === 6006) {
						return { results: request.items.map(() => null) };
					}

					throw new Failure(found.error);
				}

				const { collection, fields: collectionFields } = found.value;

				if (!collectionFields.length) {
					return { results: request.items.map(() => null) };
				}

				const filters = request.items.flatMap(({ contexts }) =>
					contexts.map((context) => context.filter)
				);
				const all = usesRelations([collection.settings.rules?.view, ...filters])
					? await this.must(this.services.collections().listWithFields())
					: [];
				const appDatabase = await this.must(this.services.database().requireApp());
				const result = await this.runChecks(
					appDatabase.id,
					collection,
					collectionFields,
					request,
					all
				);

				return this.expandAllowed(request, result);
			},
			(error) => this.error(22004, 'AUTHORIZE_FAILED', error)
		);
	}

	/**
	 * Adds `expanded` to the results: per allowed context with `expand`, the records of its events
	 * expanded in one go. A context whose `expand` no longer works (a relation was removed, or a
	 * view rule locked) gets no events, like a filter that no longer compiles.
	 */
	private async expandAllowed(
		request: AuthorizeRequest,
		result: AuthorizeResult
	): Promise<AuthorizeResult> {
		const groups = new Map<
			string,
			{ subject: Subject; expand: string[]; items: { index: number; record: ApiRecord }[] }
		>();

		request.items.forEach(({ contexts }, index) => {
			const found = result.results[index];

			for (const context of contexts) {
				if (!found || !context.expand?.length || !found.allowed.includes(context.key)) {
					continue;
				}

				const group = groups.get(context.key) ?? {
					subject: context.subject,
					expand: context.expand,
					items: []
				};

				// A copy per context: what one subject may see of a relation, another may not.
				const base =
					context.subject.kind === 'admin' ? found.record : (found.userRecord ?? found.record);

				group.items.push({ index, record: { ...base } });
				groups.set(context.key, group);
			}
		});

		if (!groups.size) {
			return result;
		}

		const expansions = await Promise.all(
			[...groups].map(async ([key, group]) => {
				const included = await this.services.records().apiInclude(
					request.collection,
					group.items.map((item) => item.record),
					group.expand,
					apiAccess(group.subject)
				);

				if (included.isErr() && included.error.code !== 8015 && included.error.code !== 8016) {
					throw new Failure(included.error);
				}

				return { key, group, expanded: included.isOk() };
			})
		);
		const results = result.results.map((found) =>
			found ? { ...found, allowed: [...found.allowed], expanded: { ...found.expanded } } : null
		);

		for (const { key, group, expanded } of expansions) {
			for (const { index, record } of group.items) {
				const found = results[index]!;

				if (expanded) {
					found.expanded[key] = record;
				} else {
					found.allowed = found.allowed.filter((allowed) => allowed !== key);
				}
			}
		}

		return { results };
	}

	private async runChecks(
		databaseId: string,
		collection: Collection,
		collectionFields: Field[],
		request: AuthorizeRequest,
		all: { collection: Collection; fields: Field[] }[]
	): Promise<AuthorizeResult> {
		const readable = apiFields(collectionFields);
		const key = collectionFields.find((field) => field.type === 'id')?.name ?? 'rowid';
		const viewOffered = apiActions(collection).includes('view');
		const checks: AuthorizeCheck[][] = request.items.map(({ event, contexts }) =>
			authorizationChecks({
				action: event.action,
				viewRule: collection.settings.rules?.view,
				viewOffered,
				readable,
				row: event.row,
				table: collection.name,
				key,
				keyParam: key === 'rowid' ? Number(event.id) : event.id,
				contexts,
				relations: all.length
					? (subject) => relatedCollections(all, subject ? apiAccess(subject) : undefined)
					: undefined
			})
		);
		// Contexts in one group share their statement, so each runs once.
		const statements = [
			...new Set(checks.flat().flatMap((check) => (check.statement ? [check.statement] : [])))
		];
		const rows = statements.length ? await batchDatabase(databaseId, statements) : [];
		const matched = new Map(
			statements.map((statement, index) => [statement, Boolean(rows[index]?.length)])
		);
		// App users get the record without its hidden fields; only made when there are any.
		const shown = collectionFields.filter((field) => !field.hidden);
		const hides = shown.length < collectionFields.length;

		return {
			results: request.items.map(({ event }, index) => ({
				record: apiRecord(collectionFields, event.row),
				...(hides ? { userRecord: apiRecord(shown, event.row) } : {}),
				allowed: checks[index]
					.filter((check) => (check.statement ? matched.get(check.statement) : check.allowed))
					.map((check) => check.key)
			}))
		};
	}
}
