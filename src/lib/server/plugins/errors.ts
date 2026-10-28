import type { ManifestIssue } from '@pouchbasejs/plugin-sdk';
import type { ServiceError } from '../services/base.service';
import type { CompileIssue } from './compile';

import { reasonOf } from '../errors';
import { Failure } from '../services/base.service';

/**
 * The errors of `PluginsService` (range 19000), also thrown as `Failure`s by the helpers next to
 * it (`install.ts`, `apply-collections.ts`, ...), which the service's `run()` turns into the
 * method's error. The `data.reason` of a few of them is shown to admins as it is.
 */
export type PluginsError =
	/** The registry couldn't be reached or answered with an error. */
	| (ServiceError<19000, 'REGISTRY_REQUEST_FAILED'> & { data: { status: number; reason: string } })
	| ServiceError<19001, 'PLUGINS_FAILED'>
	| ServiceError<19002, 'PLUGIN_NOT_FOUND'>
	| (ServiceError<19003, 'PLUGIN_INCOMPATIBLE'> & { data: { reason: string } })
	| (ServiceError<19004, 'INVALID_BUNDLE'> & { data: { issues: ManifestIssue[] } })
	| (ServiceError<19007, 'PLUGIN_DEPLOY_FAILED'> & { data: { reason: string } })
	| (ServiceError<19008, 'PROVIDER_ID_TAKEN'> & { data: { provider: string; pluginId: string } })
	| (ServiceError<19009, 'PLUGIN_CALL_FAILED'> & { data: { reason: string } })
	| ServiceError<19010, 'PLUGIN_BUILT_IN'>
	| ServiceError<19011, 'NO_WORKERS_SUBDOMAIN'>
	| (ServiceError<19013, 'PLUGIN_ROUTE_FAILED'> & { data: { reason: string } })
	| (ServiceError<19014, 'UI_COMPILE_FAILED'> & { data: { issues: CompileIssue[] } })
	| (ServiceError<19016, 'FIELD_TYPE_NOT_INSTALLED'> & {
			data: { pluginId: string; type: string | null };
	  })
	| (ServiceError<19017, 'FIELD_CALL_FAILED'> & { data: { reason: string } })
	| (ServiceError<19018, 'INVALID_PLUGIN_SETTINGS'> & { data: { issues: Record<string, string> } })
	| (ServiceError<19020, 'PLUGIN_COLLECTION_TAKEN'> & { data: { name: string } })
	| (ServiceError<19021, 'INVALID_PLUGIN_COLLECTION'> & { data: { issues: ManifestIssue[] } })
	| (ServiceError<19023, 'PLUGIN_COLLECTION_IN_USE'> & {
			data: { collection: string; field: string; target: string };
	  });

/** The error of a plugin registry request. */
export type RegistryError = Extract<PluginsError, { code: 19000 }>;

/** Throws `error` as a `Failure`; `cause` (e.g. the API's error) becomes its `reason`. */
export function fail(error: PluginsError, cause?: unknown): never {
	const reason = reasonOf(cause);

	throw new Failure(reason ? { ...error, reason } : error);
}
