import type { ManifestIssue, PluginManifest } from '../manifest.js';
import type { Logger } from './output.js';

import { readdir, readFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { transform } from 'rolldown/experimental';

import {
	BUNDLE_FORMAT,
	BUNDLE_VERSION,
	MAX_BUNDLE_SIZE,
	SERVER_FILE,
	parseBundle,
	serializeBundle,
	type PluginBundle
} from '../bundle.js';
import { unknownCategoryIssues } from '../categories.js';
import {
	MANIFEST_FILE,
	UI_DIR,
	parseManifest,
	withPackageDefaults,
	type PackageJson
} from '../manifest.js';
import { isHostModuleId } from '../ui.js';
import { compileComponents } from './components.js';
import { discoverProject, type DiscoveredProject } from './discover.js';
import { kib } from './format.js';
import { ProjectError } from './project-error.js';
import { importServerCode } from './server-entry.js';
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

/** Source files in `ui/`; TypeScript is turned into JavaScript in the bundle. */
const UI_SOURCE = /\.(?:svelte|ts|js|css|json|svg)$/;

export function toPosix(path: string) {
	return path.split(sep).join('/');
}

async function listFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);

	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name));
}

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

/** Reads and checks the manifest, with the fields it leaves out taken from `package.json`. */
export async function loadManifest(root: string): Promise<PluginManifest> {
	let json: unknown;

	try {
		json = JSON.parse(await readFile(join(root, MANIFEST_FILE), 'utf8'));
	} catch (error) {
		throw new ProjectError(`Can't read ${MANIFEST_FILE}: ${(error as Error).message}`);
	}

	const result = parseManifest(
		json && typeof json === 'object' && !Array.isArray(json)
			? withPackageDefaults(json as Record<string, unknown>, await loadPackageJson(root))
			: json
	);

	if (!result.success) {
		throw new ProjectError(`${MANIFEST_FILE} is not valid`, result.issues);
	}

	// Hosts accept any category that matches the pattern; the registry only lists known ones.
	const unknown = unknownCategoryIssues(result.manifest.categories);

	if (unknown.length) {
		throw new ProjectError(`${MANIFEST_FILE} is not valid`, unknown);
	}

	return result.manifest;
}

/** Problems with the imports of a file in `ui/` (legacy layout). */
function checkImports(path: string, source: string): ManifestIssue[] {
	const issues: ManifestIssue[] = [];

	for (const match of source.matchAll(IMPORT)) {
		const specifier = match[1] ?? match[2] ?? '';

		if (isDynamicImport(match[0])) {
			issues.push({
				path,
				message: `Imports ${specifier} with import(); UI files may only use static imports (import { x } from '${specifier}')`
			});
		} else if (specifier.startsWith('.')) {
			const target = posix.normalize(posix.join(posix.dirname(path), specifier));

			if (!target.startsWith(`${UI_DIR}/`)) {
				issues.push({ path, message: `Imports ${specifier}, which is outside ${UI_DIR}/` });
			} else if (target.endsWith('.css')) {
				// The host loads every .css file of ui/ with the plugin, and links no stylesheets.
				issues.push({
					path,
					message: `Imports ${specifier}; every .css file in ${UI_DIR}/ is loaded with the plugin, so remove the import (or use a <style> block in the component)`
				});
			} else if (!/\.(?:svelte|js)$/.test(target)) {
				issues.push({
					path,
					message: `Imports ${specifier}; UI files may only import .svelte and .js files (TypeScript modules by their .js name; inline JSON data and SVG markup)`
				});
			}
		} else if (!isHostModuleId(specifier)) {
			issues.push({
				path,
				message: `Imports ${specifier}, which Pouchbase doesn't provide; UI files may only import ${HOST_MODULES_SUMMARY} and files in ${UI_DIR}/`
			});
		}
	}

	return issues;
}

/**
 * The `ui/` files of the bundle in the legacy layout: path → contents, with TypeScript modules
 * turned into `.js`.
 */
export async function collectUi(
	root: string
): Promise<{ files: Record<string, string>; compiled: number; skipped: string[] }> {
	const files: Record<string, string> = {};
	const issues: ManifestIssue[] = [];
	const skipped: string[] = [];
	let compiled = 0;

	for (const file of await listFiles(join(root, UI_DIR))) {
		const path = toPosix(relative(root, file));

		if (!UI_SOURCE.test(path) || path.endsWith('.d.ts')) {
			if (!path.endsWith('.d.ts')) {
				skipped.push(path);
			}

			continue;
		}

		const source = await readFile(file, 'utf8');

		if (/\.(?:svelte|ts|js)$/.test(path)) {
			issues.push(...checkImports(path, source));
		}

		if (path.endsWith('.ts')) {
			const result = await transform(path, source, { lang: 'ts' });

			if (result.errors.length) {
				issues.push(...result.errors.map((error) => ({ path, message: error.message })));
				continue;
			}

			files[path.replace(/\.ts$/, '.js')] = result.code;
			compiled += 1;
		} else {
			files[path] = source;
		}
	}

	if (issues.length) {
		throw new ProjectError(`Problems in ${UI_DIR}/`, issues);
	}

	return { files, compiled, skipped };
}

const ROUTE_KEY = /^(?:GET|POST|PUT|PATCH|DELETE) \/\S*$/;

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
 * Loads the bundled server code and checks its default export against the manifest: every auth
 * provider has a complete handler, every handler has a contribution, and route keys look like
 * `GET /path`. Field types may go without a handler (they then accept every value). When the code
 * can't be loaded here, e.g. because it needs an API that only the sandbox has, that's a warning.
 * `routes` are the valid route keys, when the code loaded.
 */
export async function checkServer(
	manifest: PluginManifest,
	code: string
): Promise<{ issues: ManifestIssue[]; warnings: ManifestIssue[]; routes?: string[] }> {
	const entry = manifest.server ?? SERVER_FILE;
	const issues: ManifestIssue[] = [];
	let definition: unknown;

	try {
		definition = await importServerCode(code);
	} catch (error) {
		return {
			issues,
			warnings: [
				{
					path: entry,
					message: `Can't load the server code to check its handlers: ${(error as Error).message}`
				}
			]
		};
	}

	if (!isObject(definition)) {
		issues.push({ path: entry, message: 'Must default-export definePlugin({ ... })' });

		return { issues, warnings: [] };
	}

	const { fields, authProviders, routes } = definition;

	for (const [name, value] of [
		['fields', fields],
		['authProviders', authProviders],
		['routes', routes]
	] as const) {
		if (value !== undefined && !isObject(value)) {
			issues.push({ path: entry, message: `${name} must be an object` });
		}
	}

	const handlers = {
		fields: isObject(fields) ? fields : {},
		authProviders: isObject(authProviders) ? authProviders : {}
	};

	manifest.contributes.authProviders.forEach((provider, index) => {
		const handler = handlers.authProviders[provider.id];
		const path = `contributes.authProviders.${index}`;

		if (!isObject(handler)) {
			issues.push({ path, message: `No handler: add authProviders.${provider.id} to ${entry}` });

			return;
		}

		const problems = missingProviderMembers(handler);

		if (problems.length) {
			issues.push({
				path,
				message: `The handler in ${entry} lacks ${problems.join(', ')}`
			});
		}
	});

	for (const [key, ids] of [
		['fields', new Set(manifest.contributes.fields.map((field) => field.type))],
		['authProviders', new Set(manifest.contributes.authProviders.map((provider) => provider.id))]
	] as const) {
		for (const id of Object.keys(handlers[key])) {
			if (!ids.has(id)) {
				issues.push({
					path: entry,
					message: `${key}.${id} has no contribution in contributes.${key} of ${MANIFEST_FILE}`
				});
			}
		}
	}

	const routeKeys: string[] = [];

	if (isObject(routes)) {
		for (const [key, handler] of Object.entries(routes)) {
			if (!ROUTE_KEY.test(key)) {
				issues.push({
					path: entry,
					message: `routes["${key}"]: use a method and a path, e.g. "GET /stats"`
				});
			} else if (typeof handler !== 'function') {
				issues.push({ path: entry, message: `routes["${key}"] must be a function` });
			} else {
				routeKeys.push(key);
			}
		}
	}

	return { issues, warnings: [], routes: routeKeys };
}

/**
 * Validates the project and builds its bundle, in either layout (see `discoverProject`); `warnings`
 * are problems that don't stop it, `routes` the route keys of the server code (empty when it has
 * none or could not be loaded), `project` what discovery found. `log` reports every step, so the
 * CLI can show what it is doing.
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
