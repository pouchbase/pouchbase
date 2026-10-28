import type { Pouchbase } from '@pouchbasejs/js-sdk';
import type { PluginManifest } from '@pouchbasejs/plugin-sdk';
import type { ServerDefinition } from '@pouchbasejs/plugin-sdk/server';
import type { EmbeddedPlugin } from './embedded';
import type {
	DescribeResult,
	PluginCall,
	PluginCallContext,
	PluginRouteContext,
	PluginRouteInfo,
	PluginRuntime
} from './protocol';

import { dispatch, dispatchRoute, pluginContext, routeRequestHeaders } from './dispatch';
import { restrictedFetch } from './network';
import { CALL_TIMEOUT, describePlugin, EMPTY_CALL_CONTEXT, withTimeout } from './protocol';

/**
 * Running a plugin's server code inside Pouchbase: the built-in plugins always do, and in
 * development installed plugins do too (see `RUN_INSTALLED_IN_PROCESS` in `install.ts`).
 */

/**
 * Runs a plugin's server code inside Pouchbase. `pouch` is its `ctx.pouch`, which the host builds
 * for the request (see `PluginsService`); without one, its requests fail.
 */
export class InProcessRuntime implements PluginRuntime {
	constructor(
		private readonly plugin: EmbeddedPlugin,
		private readonly options: { timeout?: number; fetch?: typeof fetch; pouch?: Pouchbase } = {}
	) {}

	async call(call: PluginCall, context: PluginCallContext = EMPTY_CALL_CONTEXT): Promise<unknown> {
		const { manifest } = this.plugin;
		const ctx = pluginContext(
			manifest,
			context,
			restrictedFetch(manifest.permissions.network, this.options.fetch ?? fetch),
			{ pouch: this.options.pouch }
		);

		return withTimeout(
			this.plugin.load().then((definition) => dispatch(definition, call, ctx)),
			this.options.timeout ?? CALL_TIMEOUT
		);
	}

	/**
	 * Runs the route for `request` directly, like the Worker does: the handler gets the request
	 * with its original URL, without the cookie and the host's own headers.
	 */
	async route(
		request: Request,
		info: PluginRouteInfo,
		context: PluginRouteContext
	): Promise<Response> {
		const { manifest } = this.plugin;
		const ctx = pluginContext(
			manifest,
			context,
			restrictedFetch(manifest.permissions.network, this.options.fetch ?? fetch),
			{ admin: context.admin, user: context.user, pouch: this.options.pouch }
		);
		const forwarded = new Request(request, { headers: routeRequestHeaders(request.headers) });

		return withTimeout(
			this.plugin.load().then((definition) => dispatchRoute(definition, forwarded, info.path, ctx)),
			this.options.timeout ?? CALL_TIMEOUT
		);
	}
}

const descriptions = new Map<string, Promise<DescribeResult>>();

/**
 * `describe` of a built-in plugin, with its settings. Its code can't change within a build, so
 * the answer is kept per plugin and settings.
 */
export function describeEmbedded(
	plugin: EmbeddedPlugin,
	context: PluginCallContext = EMPTY_CALL_CONTEXT
): Promise<DescribeResult> {
	const key = `${plugin.manifest.id}\n${JSON.stringify(context.settings)}`;
	let description = descriptions.get(key);

	if (!description) {
		description = describePlugin(new InProcessRuntime(plugin), context);
		description.catch(() => descriptions.delete(key));
		descriptions.set(key, description);
	}

	return description;
}

/** Imported server modules, by plugin id, version and code, so each version is imported once. */
const modules = new Map<string, Promise<ServerDefinition | undefined>>();

/** A short hash of the code (FNV-1a), so a rebuilt plugin with the same version is imported again. */
function hash(code: string) {
	let value = 0x811c9dc5;

	for (let i = 0; i < code.length; i++) {
		value = Math.imul(value ^ code.charCodeAt(i), 0x01000193);
	}

	return (value >>> 0).toString(36);
}

/** Imports the bundled `server.js` of a plugin, which imports nothing and default-exports it all. */
function importServer(key: string, code: string) {
	let module = modules.get(key);

	if (!module) {
		const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

		module = import(/* @vite-ignore */ url).then(
			(loaded: { default?: ServerDefinition }) => loaded.default,
			(error: unknown) => {
				modules.delete(key);

				throw error;
			}
		);
		modules.set(key, module);
	}

	return module;
}

/**
 * An installed plugin as `InProcessRuntime` runs it: `code` is its `server.js`, or reads it from
 * the stored bundle when it is first needed (`null` when there is none).
 */
export function installedInProcess(
	manifest: PluginManifest,
	code: string | (() => Promise<string | null>)
): EmbeddedPlugin {
	return {
		manifest,
		assets: {},
		async load() {
			const source = typeof code === 'string' ? code : await code();

			if (source === null) {
				throw new Error(`The server code of ${manifest.id} is not stored`);
			}

			return importServer(`${manifest.id}@${manifest.version}:${hash(source)}`, source);
		}
	};
}
