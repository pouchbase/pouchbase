import type { ManifestIssue, PackageJson, PluginManifest } from '../manifest.js';
import type { Logger } from './output.js';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
	BUNDLE_FORMAT,
	BUNDLE_VERSION,
	MAX_BUNDLE_SIZE,
	SERVER_FILE,
	parseBundle,
	serializeBundle,
	type PluginBundle
} from '../bundle.js';
import { compileComponents } from './components.js';
import { discoverProject, type DiscoveredProject } from './discover.js';
import { kib } from './format.js';
import { ProjectError } from './project-error.js';
import { TAILWIND_FILE, compileTailwind } from './tailwind.js';

/**
 * Loading, checking and building a plugin project on disk; `discover.ts` finds what the project
 * contributes. Functions throw `ProjectError`.
 */

export { ProjectError };

/** Static imports, re-exports and dynamic imports. */
export const IMPORT =
	/(?:\bimport|\bexport)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

/** Whether a match of `IMPORT` is a dynamic `import('...')`, which the host refuses. */
export function isDynamicImport(match: string) {
	return /^import\s*\(/.test(match);
}

/**
 * The modules a UI file may import, for messages: exactly the `HOST_MODULE_IDS` (the host links
 * nothing else, so `@pouchbasejs/ui/<component>` must be a component it has).
 */
export const HOST_MODULES_SUMMARY =
	'svelte (and svelte/store, svelte/transition, svelte/animate, svelte/easing, svelte/motion, svelte/reactivity, svelte/events, svelte/attachments), @pouchbasejs/plugin-sdk/ui, @pouchbasejs/ui and its components (@pouchbasejs/ui/button, ...)';

/** The plugin's `package.json`, or `{}` when there is none. */
export async function loadPackageJson(root: string): Promise<PackageJson> {
	let text: string;

	try {
		text = await readFile(join(root, 'package.json'), 'utf8');
	} catch {
		return {};
	}

	try {
		const json: unknown = JSON.parse(text);

		return json && typeof json === 'object' ? (json as PackageJson) : {};
	} catch (error) {
		throw new ProjectError(`Can't read package.json: ${(error as Error).message}`);
	}
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The members an auth provider handler lacks or has of the wrong type, e.g. `['pkce']`. */
export function missingProviderMembers(handler: Record<string, unknown>): string[] {
	return [
		typeof handler.authorizeUrl === 'string' ? null : 'authorizeUrl',
		typeof handler.tokenUrl === 'string' ? null : 'tokenUrl',
		Array.isArray(handler.scopes) ? null : 'scopes',
		typeof handler.pkce === 'boolean' ? null : 'pkce',
		typeof handler.profile === 'function' ? null : 'profile'
	].filter((problem) => problem !== null);
}

/**
 * Validates the project and builds its bundle (see `discoverProject`); `warnings` are problems that
 * don't stop it, `routes` the route keys of the server code (empty when it has none or could not be
 * loaded), `project` what discovery found. `log` reports every step, so the CLI can show what it is
 * doing.
 */
export async function buildBundle(
	root: string,
	{ log }: { log?: Logger } = {}
): Promise<{
	bundle: PluginBundle;
	bytes: Uint8Array<ArrayBuffer>;
	warnings: ManifestIssue[];
	routes: string[];
	project: DiscoveredProject;
}> {
	const project = await discoverProject(root, { log });
	const files: Record<string, string> = { ...project.uiFiles };
	const warnings = [...project.warnings];

	if (TAILWIND_FILE in files) {
		throw new ProjectError(
			`${TAILWIND_FILE} is generated from the Tailwind classes of the components; rename the file`
		);
	}

	// What the host does on install: compile the components and link every UI module.
	warnings.push(...(await compileComponents(root, project, { log })));

	const tailwind = await compileTailwind(root, project.uiFiles, { log });

	warnings.push(...tailwind.warnings);

	if (tailwind.css !== null) {
		files[TAILWIND_FILE] = tailwind.css;
	}

	if (project.serverCode !== null) {
		files[SERVER_FILE] = project.serverCode;
	}

	log?.step('Checking the bundle');

	const draft = {
		format: BUNDLE_FORMAT,
		bundleVersion: BUNDLE_VERSION,
		manifest: project.manifest,
		files
	} satisfies PluginBundle;
	const bytes = serializeBundle(draft);

	if (bytes.byteLength > MAX_BUNDLE_SIZE) {
		throw new ProjectError(
			`The bundle is ${Math.ceil(bytes.byteLength / 1024)} KiB; the limit is ${MAX_BUNDLE_SIZE / 1024} KiB`
		);
	}

	// The same check a host does on install, e.g. for components that don't exist.
	const result = parseBundle(bytes);

	if (!result.success) {
		throw new ProjectError('The bundle is not valid', result.issues);
	}

	log?.detail(`${kib(bytes.byteLength)} of at most ${kib(MAX_BUNDLE_SIZE)}`);

	return {
		bundle: result.bundle,
		bytes,
		warnings,
		routes: project.routes,
		project
	};
}

/** File name of a built bundle, e.g. `color-picker-1.0.0.json`. */
export function bundleFileName(manifest: PluginManifest) {
	return `${manifest.id}-${manifest.version}.json`;
}
