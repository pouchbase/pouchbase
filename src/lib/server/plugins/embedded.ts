import type { PluginManifest } from '@pouchbasejs/plugin-sdk';
import type { ServerDefinition } from '@pouchbasejs/plugin-sdk/server';

import { parseManifest } from '@pouchbasejs/plugin-sdk';
import * as discovered from 'virtual:pouchbase/embedded-plugins';

/**
 * Built-in plugins: the first-party plugins in `plugins/*` of this repository, bundled into
 * Pouchbase at build time. `vite/embedded-plugins.ts` reads every folder like
 * `pouchbase-plugin build` does and hands over the manifests (with `contributes` and the fields
 * from `package.json`), their `.svg` files and their generated server entries, which Vite compiles
 * from the plugins' sources. They ship with the app, so their `engines` range is not checked, and
 * they can't be removed. Their server code runs inside Pouchbase (`InProcessRuntime` in
 * `in-process.ts`), with the same `ctx.fetch` allowlist as an installed plugin. Installing the same plugin id from the registry
 * shadows the built-in one.
 */

/** A module whose default export is what the host runs: the generated server entry. */
type ServerModule = { default?: ServerDefinition };

/** One folder of `plugins/`, as `virtual:pouchbase/embedded-plugins` has it. */
export type EmbeddedSource = {
	/** The folder from the repository root, e.g. `/plugins/auth-google`. */
	dir: string;
	/** The manifest as a bundle has it; validated again here. */
	manifest: unknown;
	/** Bundle path (`ui/auth/google/icon.svg`) → contents. */
	assets: Record<string, string>;
	/** Imports the generated server entry; `null` without server code. */
	server: (() => Promise<ServerModule>) | null;
};

/** What the Vite plugin found: the plugins, and the folders it couldn't read. */
type EmbeddedSources = {
	plugins: readonly EmbeddedSource[];
	issues: readonly EmbeddedIssue[];
};

export type EmbeddedPlugin = {
	manifest: PluginManifest;
	/** Bundle path (`ui/auth/google/icon.svg`) → contents. */
	assets: Record<string, string>;
	/** Imports the server code; `undefined` without one. */
	load(): Promise<ServerDefinition | undefined>;
};

export type EmbeddedIssue = { dir: string; message: string };

/** Reads the built-in plugins from what the Vite plugin found; invalid ones are left out as issues. */
export function loadEmbeddedPlugins(sources: EmbeddedSources): {
	plugins: EmbeddedPlugin[];
	issues: EmbeddedIssue[];
} {
	const plugins: EmbeddedPlugin[] = [];
	const issues: EmbeddedIssue[] = [...sources.issues];

	for (const source of [...sources.plugins].sort((a, b) => a.dir.localeCompare(b.dir))) {
		const { dir } = source;
		const raw = source.manifest;
		const result = parseManifest(typeof raw === 'object' && raw ? raw : {});

		if (!result.success) {
			const issue = result.issues[0];

			issues.push({
				dir,
				message: `Invalid manifest${issue ? `: ${issue.path ? `${issue.path}: ` : ''}${issue.message}` : ''}`
			});
			continue;
		}

		const { manifest } = result;

		if (plugins.some((plugin) => plugin.manifest.id === manifest.id)) {
			issues.push({ dir, message: `Duplicate plugin id: ${manifest.id}` });
			continue;
		}

		const loader = manifest.server ? source.server : null;

		if (manifest.server && !loader) {
			issues.push({ dir, message: `Missing server code: ${manifest.server}` });
			continue;
		}

		const assets = { ...source.assets };
		const missing = [
			...(manifest.icon ? [manifest.icon] : []),
			...manifest.contributes.authProviders.flatMap((provider) => provider.icon ?? []),
			...manifest.contributes.fields.flatMap((field) => field.icon ?? []),
			...manifest.contributes.pages.flatMap((page) => page.icon ?? [])
		].filter((icon) => !Object.hasOwn(assets, icon));

		if (missing.length) {
			issues.push({ dir, message: `Missing file: ${missing[0]}` });
			continue;
		}

		let loaded: Promise<ServerDefinition | undefined> | undefined;

		plugins.push({
			manifest,
			assets,
			load() {
				if (!loader) {
					return Promise.resolve(undefined);
				}

				loaded ??= loader().then(
					(module) => module.default,
					(error) => {
						loaded = undefined;

						throw error;
					}
				);

				return loaded;
			}
		});
	}

	return { plugins, issues };
}

let cached: EmbeddedPlugin[] | undefined;

/** The built-in plugins of this build. */
export function embeddedPlugins(): EmbeddedPlugin[] {
	if (!cached) {
		const { plugins, issues } = loadEmbeddedPlugins(discovered);

		for (const issue of issues) {
			console.error(`[plugins] Skipping the built-in plugin in ${issue.dir}: ${issue.message}`);
		}

		cached = plugins;
	}

	return cached;
}

/** The built-in plugin with this id, or `null`. */
export function embeddedPlugin(id: string): EmbeddedPlugin | null {
	return embeddedPlugins().find((plugin) => plugin.manifest.id === id) ?? null;
}
