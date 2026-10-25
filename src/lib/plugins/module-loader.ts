import type { Component } from 'svelte';

import type { HostModuleId } from './host-module-ids';
import {
	embeddedModulePath,
	ModuleLinker,
	PluginModuleError,
	shimCode,
	type ModuleGraph
} from './module-linker';

/**
 * Loads the Svelte components of plugins in the browser.
 *
 * - Installed plugins: the host compiled their components on install; the loader fetches the whole
 *   module graph once per version (`GET /api/plugins/<id>/modules?v=<version>`, cached by the
 *   browser for good), turns each module into a `blob:` URL (`./module-linker.ts`) and imports it.
 *   Host modules (`svelte`, `@pouchbasejs/ui/...`) come from the dashboard's registry
 *   (`./host-modules.ts`), so plugins share its Svelte runtime.
 * - Built-in plugins (`plugins/*`): Vite compiled their components with the app, so they are lazy
 *   chunks of the dashboard.
 *
 * The plugin's stylesheets are injected once per plugin, as `<style data-plugin="<id>">`.
 */

/** The plugin a component belongs to; `InstalledPlugin` fits. */
export type PluginRef = { id: string; version: string; embedded: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin components take any props
export type PluginComponent = Component<any>;

type ComponentModule = { default?: unknown };

/** Components of the built-in plugins: the legacy `ui/` folder and the convention folders. */
const embeddedComponents = import.meta.glob<ComponentModule>([
	'/plugins/*/ui/**/*.svelte',
	'/plugins/*/{fields,pages}/**/*.svelte'
]);

const embeddedStyles = import.meta.glob<string>(
	['/plugins/*/ui/**/*.css', '/plugins/*/{fields,pages}/**/*.css'],
	{ query: '?inline', import: 'default' }
);

/** `pluginId` → bundle path → the glob's loader. */
function byPlugin<T>(glob: Record<string, () => Promise<T>>) {
	const plugins = new Map<string, Map<string, () => Promise<T>>>();

	for (const [key, load] of Object.entries(glob)) {
		const file = embeddedModulePath(key);

		if (!file) {
			continue;
		}

		let files = plugins.get(file.pluginId);

		if (!files) {
			files = new Map();
			plugins.set(file.pluginId, files);
		}

		files.set(file.path, load);
	}

	return plugins;
}

const embedded = { components: byPlugin(embeddedComponents), styles: byPlugin(embeddedStyles) };

/** Shim URLs of the host modules, shared by every plugin. */
const hostUrls = new Map<HostModuleId, Promise<string>>();

/** Linkers per `<id>@<version>`. */
const graphs = new Map<string, Promise<ModuleLinker>>();

/** Components per `<id>@<version>` and path. */
const components = new Map<string, Promise<PluginComponent>>();

function blobUrl(code: string): string {
	return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
}

async function hostUrl(id: HostModuleId): Promise<string> {
	let url = hostUrls.get(id);

	if (!url) {
		url = (async () => {
			const { registerHostModules } = await import('./host-modules');
			const namespace = await registerHostModules().load(id);

			return blobUrl(shimCode(id, Object.keys(namespace)));
		})();
		hostUrls.set(id, url);
		url.catch(() => hostUrls.delete(id));
	}

	return url;
}

/** Puts the plugin's CSS in the document once; a newer version replaces it. */
function injectStyles(plugin: PluginRef, css: readonly string[]) {
	const existing = document.head.querySelector<HTMLStyleElement>(
		`style[data-plugin="${CSS.escape(plugin.id)}"]`
	);

	if (existing?.dataset.version === plugin.version) {
		return;
	}

	const style = existing ?? document.createElement('style');

	style.dataset.plugin = plugin.id;
	style.dataset.version = plugin.version;
	style.textContent = css.join('\n');

	if (!existing) {
		document.head.appendChild(style);
	}
}

/** The message of an error answer of the API (`{ message }` or `{ error: { message } }`). */
async function responseError(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as {
		message?: unknown;
		error?: unknown;
	} | null;
	const message =
		typeof body?.message === 'string'
			? body.message
			: typeof body?.error === 'string'
				? body.error
				: (body?.error as { message?: unknown } | undefined)?.message;

	return typeof message === 'string' && message
		? message
		: `the server answered ${response.status}`;
}

function isModuleGraph(value: unknown): value is ModuleGraph {
	const graph = value as ModuleGraph | null;

	return (
		typeof graph === 'object' &&
		graph !== null &&
		typeof graph.modules === 'object' &&
		graph.modules !== null &&
		Object.values(graph.modules).every((module) => typeof module?.code === 'string') &&
		(graph.css === undefined || Array.isArray(graph.css))
	);
}

async function fetchGraph(plugin: PluginRef): Promise<ModuleLinker> {
	const response = await fetch(
		`/api/plugins/${encodeURIComponent(plugin.id)}/modules?v=${encodeURIComponent(plugin.version)}`,
		{ credentials: 'same-origin' }
	);

	if (!response.ok) {
		throw new PluginModuleError(`Could not load the components: ${await responseError(response)}`);
	}

	const graph: unknown = await response.json();

	if (!isModuleGraph(graph)) {
		throw new PluginModuleError('Could not load the components: the answer is not a module graph');
	}

	injectStyles(plugin, graph.css ?? []);

	return new ModuleLinker(graph.modules, { createUrl: blobUrl, hostUrl });
}

function linkerFor(plugin: PluginRef): Promise<ModuleLinker> {
	const key = `${plugin.id}@${plugin.version}`;
	let linker = graphs.get(key);

	if (!linker) {
		linker = fetchGraph(plugin);
		graphs.set(key, linker);
		// A failed request is tried again the next time.
		linker.catch(() => graphs.delete(key));
	}

	return linker;
}

async function loadEmbeddedStyles(pluginId: string) {
	const styles = embedded.styles.get(pluginId);

	if (!styles?.size) {
		return [];
	}

	return Promise.all([...styles.values()].map((load) => load()));
}

async function loadInstalled(plugin: PluginRef, path: string): Promise<unknown> {
	const linker = await linkerFor(plugin);

	if (!linker.has(path)) {
		throw new PluginModuleError(`The plugin has no component ${path}`);
	}

	const url = await linker.url(path);
	const module = (await import(/* @vite-ignore */ url)) as ComponentModule;

	return module.default;
}

async function loadEmbedded(plugin: PluginRef, path: string): Promise<unknown> {
	const load = embedded.components.get(plugin.id)?.get(path);

	if (!load) {
		throw new PluginModuleError(`The plugin has no component ${path}`);
	}

	const [module, css] = await Promise.all([load(), loadEmbeddedStyles(plugin.id)]);

	injectStyles(plugin, css);

	return module.default;
}

/**
 * The component at `path` (a bundle path, e.g. `ui/pages/overview.svelte`) of a plugin. Cached per
 * plugin version; a failure is tried again on the next call. Browser only.
 */
export function loadPluginComponent(plugin: PluginRef, path: string): Promise<PluginComponent> {
	const key = `${plugin.id}@${plugin.version}${plugin.embedded ? ' (built in)' : ''}:${path}`;
	let component = components.get(key);

	if (!component) {
		component = (async () => {
			const exported = await (plugin.embedded
				? loadEmbedded(plugin, path)
				: loadInstalled(plugin, path));

			if (typeof exported !== 'function') {
				throw new PluginModuleError(`${path} doesn't export a component`);
			}

			return exported as PluginComponent;
		})();
		components.set(key, component);
		component.catch(() => components.delete(key));
	}

	return component;
}
