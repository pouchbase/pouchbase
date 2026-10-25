import { HOST_MODULE_IDS, type HostModuleId } from '@pouchbasejs/plugin-sdk/ui';

/**
 * The modules the dashboard lends to plugin components (`HOST_MODULE_IDS` of the plugin SDK), and
 * where it keeps them: `registerHostModules()` (`./host-modules.ts`) puts a `HostModuleRegistry`
 * on `globalThis` under `HOST_MODULES_KEY`, and the shim modules the loader generates read from it.
 * This module imports none of them, so the loader can use it without pulling them in.
 */
export { HOST_MODULE_IDS, type HostModuleId };

/** `globalThis[HOST_MODULES_KEY]` holds the `HostModuleRegistry`. */
export const HOST_MODULES_KEY = 'pouchbase.host-modules';

/** What `import * as ns from '<id>'` gives. */
export type ModuleNamespace = Readonly<Record<string, unknown>>;

export type HostModuleRegistry = {
	/** Loads a host module; the result is also stored in `resolved`. */
	load(id: HostModuleId): Promise<ModuleNamespace>;
	/** Host modules loaded so far, read synchronously by the shims. */
	resolved: Partial<Record<HostModuleId, ModuleNamespace>>;
};

const ids: ReadonlySet<string> = new Set(HOST_MODULE_IDS);

/** Whether a plugin module may import `specifier` from the dashboard. */
export function isHostModuleId(specifier: string): specifier is HostModuleId {
	return ids.has(specifier);
}

/** The registry `registerHostModules()` set up, if it ran. */
export function hostModuleRegistry(): HostModuleRegistry | undefined {
	return (globalThis as Record<string, unknown>)[HOST_MODULES_KEY] as
		HostModuleRegistry | undefined;
}
