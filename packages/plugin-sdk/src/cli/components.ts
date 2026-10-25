import type { ManifestIssue } from '../manifest.js';
import type { DiscoveredProject } from './discover.js';
import type { Logger } from './output.js';

import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	compileUi,
	formatCompileIssue,
	type CompileIssue,
	type SvelteCompiler
} from '../compile.js';
import { HOST_MODULE_IDS } from '../ui.js';
import { count } from './format.js';
import { ProjectError } from './project-error.js';

/**
 * Compiles the plugin's components the way a host does on install (`compileUi` of the SDK, with
 * the host's options), with the Svelte compiler of the plugin project, so `validate`, `build` and
 * `dev` report what an install would refuse: Svelte errors and imports the host can't link.
 */

/** Why a host refuses an import, and what to do instead. */
export const HOST_MODULES_HINT = `Pouchbase provides only these modules to UI files: ${HOST_MODULE_IDS.filter((id) => !id.startsWith('svelte/internal/')).join(', ')}.`;

export const DYNAMIC_IMPORT_HINT =
	'Import modules statically at the top of the file (import { x } from "./x.js"); the dashboard links the modules of a plugin before it runs them.';

/** `svelte/compiler` of the plugin project, or `null` when the project has no Svelte. */
export async function loadProjectSvelte(root: string): Promise<SvelteCompiler | null> {
	const require = createRequire(join(resolve(root), 'package.json'));
	let path: string;

	try {
		path = require.resolve('svelte/compiler');
	} catch {
		return null;
	}

	const module = (await import(pathToFileURL(path).href)) as Partial<SvelteCompiler> & {
		default?: Partial<SvelteCompiler>;
	};
	const compile = module.compile ?? module.default?.compile;

	return typeof compile === 'function' ? { compile } : null;
}

/** An issue of a bundle path, at `file:line:column` of the project file it comes from. */
function projectIssue(
	issue: CompileIssue,
	sources: Readonly<Record<string, string>>
): ManifestIssue {
	const source = sources[issue.path] ?? issue.path;
	// Positions in a module compiled from TypeScript are in the JavaScript, not in the source.
	const { line, column }: Pick<CompileIssue, 'line' | 'column'> = source.endsWith('.ts')
		? {}
		: issue;
	const where = formatCompileIssue({ path: source, line, column, message: '' });

	return { path: where.slice(0, -2), message: issue.message };
}

/**
 * Compiles every component of `project` and checks the imports of every UI module; throws a
 * `ProjectError` with each problem at `file:line:column`. Returns the warnings, e.g. when the
 * project has no Svelte to compile with.
 */
export async function compileComponents(
	root: string,
	project: Pick<DiscoveredProject, 'uiFiles' | 'uiSources'>,
	{ log }: { log?: Logger } = {}
): Promise<ManifestIssue[]> {
	const components = Object.keys(project.uiFiles).filter((path) => path.endsWith('.svelte'));
	const warnings: ManifestIssue[] = [];
	let svelte: SvelteCompiler | null = null;

	if (components.length) {
		log?.step('Compiling the components');

		svelte = await loadProjectSvelte(root);

		if (!svelte) {
			warnings.push({
				path: 'package.json',
				message:
					"Can't compile the components: add svelte as a devDependency; until then, Svelte errors only show when the plugin is installed"
			});
		}
	}

	const { issues } = compileUi(project.uiFiles, svelte);

	if (issues.length) {
		const hints = [
			issues.some((issue) => issue.message.startsWith('Dynamic import()'))
				? DYNAMIC_IMPORT_HINT
				: null,
			issues.some((issue) => issue.message.includes('only modules Pouchbase provides'))
				? HOST_MODULES_HINT
				: null
		].filter((hint) => hint !== null);

		throw new ProjectError(
			'Problems in the UI files',
			issues.map((issue) => projectIssue(issue, project.uiSources)),
			hints.length ? hints.join(' ') : undefined
		);
	}

	if (svelte) {
		log?.detail(`${count(components.length, 'component')} compiled`);
	}

	return warnings;
}
