import type { Logger } from '../output.js';
import type { Problem } from './problems.js';

import type { CollectionContribution } from '../../collections.js';
import type {
	AuthProviderContribution,
	FieldContribution,
	PageContribution
} from '../../manifest.js';

import { pluginSettingsSchema, type PluginSetting } from '../../settings-schema.js';
import { isObject } from '../project.js';
import { ProjectError } from '../project-error.js';
import { bundleServerCode, importServerCode } from '../server-entry.js';
import {
	DEFINITION_KEYS,
	authProviderContributions,
	collectionContributions,
	definitionRoutes,
	fieldContributions,
	pageContributions,
	type DefinitionScope,
	type FileUse
} from './contributions.js';
import { createIconResolver } from './icons.js';
import { fail } from './problems.js';

/** What `definePlugin({ ... })` in `plugin.ts` adds, checked. */
export type PluginContents = {
	settings: PluginSetting[];
	fields: FieldContribution[];
	pages: PageContribution[];
	authProviders: AuthProviderContribution[];
	collections: CollectionContribution[];
	/** Route keys, e.g. `GET /items/:id`. */
	routes: string[];
	/** The components the contributions name. */
	components: FileUse[];
	/** Project paths of the imported icon files. */
	iconFiles: string[];
	/** Bundle path → SVG of every icon given by Iconify name. */
	iconifyIcons: Record<string, string>;
};

/** `definePlugin({ ... })` as `plugin.ts` default-exports it, after the bundle ran in Node.js. */
export async function loadDefinition(root: string, file: string): Promise<Record<string, unknown>> {
	const code = await bundleServerCode(root, { file });
	let definition: unknown;

	try {
		definition = await importServerCode(code);
	} catch (error) {
		throw new ProjectError(
			`Can't load ${file}: ${(error as Error).message}`,
			[],
			`The CLI runs ${file} in Node.js to read the plugin; keep the top level of ${file} and the files it imports free of APIs that only the sandbox has.`
		);
	}

	if (!isObject(definition)) {
		fail([
			{
				path: file,
				message: 'must default-export definePlugin({ ... })',
				hint: "import { definePlugin } from '@pouchbasejs/plugin-sdk/server'; export default definePlugin({ settings: [], fields: {}, pages: {}, routes: {} });"
			}
		]);
	}

	return definition;
}

/**
 * Reads `file` (`plugin.ts`) in `root`: what the plugin adds, from `definePlugin({ ... })`. Throws
 * a `ProjectError` with every problem.
 */
export async function readDefinition(
	root: string,
	file: string,
	log?: Logger
): Promise<PluginContents> {
	const definition = await loadDefinition(root, file);
	const problems: Problem[] = [];

	for (const key of Object.keys(definition)) {
		if (!(DEFINITION_KEYS as readonly string[]).includes(key)) {
			problems.push({
				path: file,
				message: `definePlugin({ ${key} }) isn't something a plugin adds; use ${DEFINITION_KEYS.join(', ')}`
			});
		}
	}

	// Settings
	const settingsResult = pluginSettingsSchema.safeParse(definition.settings ?? []);
	let settings: PluginSetting[] = [];

	if (settingsResult.success) {
		settings = settingsResult.data;
	} else {
		problems.push(
			...settingsResult.error.issues.map((issue) => ({
				path: file,
				message: `${['settings', ...issue.path].join('.')}: ${issue.message}`
			}))
		);
	}

	const icons = createIconResolver(root, file, problems, log);
	const scope: DefinitionScope = { definition, file, problems, icons, components: [] };
	const fields = await fieldContributions(scope);
	const pages = await pageContributions(scope);
	const authProviders = await authProviderContributions(scope);
	const collections = collectionContributions(scope);
	const routes = definitionRoutes(scope);

	if (problems.length) {
		fail(problems, `Problems in ${file}`);
	}

	return {
		settings,
		fields,
		pages,
		authProviders,
		collections,
		routes,
		components: scope.components,
		iconFiles: icons.iconFiles,
		iconifyIcons: icons.iconifyIcons
	};
}
