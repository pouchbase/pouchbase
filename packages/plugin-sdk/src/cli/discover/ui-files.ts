import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { transform } from 'rolldown/experimental';

import { UI_DIR } from '../../manifest.js';
import { isHostModuleId } from '../../ui.js';
import { DYNAMIC_IMPORT_HINT, HOST_MODULES_HINT } from '../components.js';
import { HOST_MODULES_SUMMARY, IMPORT, isDynamicImport } from '../project.js';
import { fail, type Problem } from './problems.js';

/**
 * Files a UI file may import, by their extension in the project: the host compiles `.svelte` and
 * links `.js` (TypeScript becomes `.js`), and refuses to import anything else.
 */
const UI_MODULE = /\.(?:svelte|ts|js)$/;

/** Why a UI file can't import a file of another kind, and what to do instead. */
const UI_IMPORT_HINTS: Record<string, string> = {
	'.css':
		'Pouchbase loads no stylesheets from imports: put the styles in a <style> block of the component, where they are scoped to it.',
	'.json':
		'Pouchbase only links JavaScript: inline the data in a .ts module, e.g. export const data = { ... };',
	'.svg': 'Pouchbase only links JavaScript: inline the SVG markup in a component.'
};

/** The module of the server code's helpers; a file that imports it is server code. */
const SERVER_MODULE = '@pouchbasejs/plugin-sdk/server';

/** The bundle path of a UI file of the project: `lib/stars.ts` → `ui/lib/stars.js`. */
export function uiBundlePath(path: string) {
	return `${UI_DIR}/${path.replace(/\.ts$/, '.js')}`;
}

/**
 * The UI files of the bundle: `entries` (components and images) and every project file they
 * import, each under `ui/` at its project path. `serverFiles` can't be imported.
 */
export async function collectUiFiles(
	root: string,
	entries: readonly string[],
	all: Set<string>,
	serverFiles: ReadonlySet<string>
) {
	const uiFiles: Record<string, string> = {};
	const uiSources: Record<string, string> = {};
	const problems: Problem[] = [];
	const queue = [...entries];
	const seen = new Set<string>();
	/** The file that first imported each file, for messages. */
	const importers = new Map<string, string>();
	let compiled = 0;

	while (queue.length) {
		const path = queue.shift()!;

		if (seen.has(path)) {
			continue;
		}

		seen.add(path);

		let source = await readFile(join(root, path), 'utf8');

		if (path.endsWith('.ts')) {
			const result = await transform(path, source, { lang: 'ts' });

			if (result.errors.length) {
				problems.push(...result.errors.map((error) => ({ path, message: error.message })));
				continue;
			}

			source = result.code;
			compiled += 1;
		}

		if (/\.(?:svelte|ts|js)$/.test(path)) {
			for (const match of source.matchAll(IMPORT)) {
				const specifier = match[1] ?? match[2] ?? '';

				if (isDynamicImport(match[0])) {
					problems.push({
						path,
						message: `imports ${specifier} with import(); UI files may only use static imports`,
						hint: DYNAMIC_IMPORT_HINT
					});
					continue;
				}

				if (specifier === SERVER_MODULE) {
					const importer = importers.get(path);

					problems.push(
						importer
							? {
									path: importer,
									message: `imports ${path}, which is server code (it imports ${SERVER_MODULE}); move what both need into a shared file, e.g. lib/`
								}
							: { path, message: `imports ${SERVER_MODULE}, which only server code can import` }
					);
					continue;
				}

				if (!specifier.startsWith('.')) {
					if (!isHostModuleId(specifier)) {
						problems.push({
							path,
							message: `imports ${specifier}, which Pouchbase doesn't provide; UI files may only import ${HOST_MODULES_SUMMARY} and other files of the plugin`,
							hint: `${HOST_MODULES_HINT} Other packages and server code are not available in the browser.`
						});
					}

					continue;
				}

				const target = posix.normalize(posix.join(posix.dirname(path), specifier));
				const resolved = all.has(target)
					? target
					: target.endsWith('.js') && all.has(target.replace(/\.js$/, '.ts'))
						? target.replace(/\.js$/, '.ts')
						: null;

				if (target.startsWith('../')) {
					problems.push({ path, message: `imports ${specifier}, which is outside the plugin` });
				} else if (specifier.endsWith('.ts')) {
					problems.push({
						path,
						message: `imports ${specifier}; import TypeScript modules by their .js name (${specifier.replace(/\.ts$/, '.js')}), as they are in the bundle`
					});
				} else if (!resolved) {
					problems.push({
						path,
						message: `imports ${specifier}, which doesn't exist (write the file extension, e.g. ./stars.js)`
					});
				} else if (serverFiles.has(resolved)) {
					problems.push({
						path,
						message: `imports ${resolved}, which is server code; move what both need into a shared file, e.g. lib/`
					});
				} else if (!UI_MODULE.test(resolved)) {
					const extension = posix.extname(resolved);

					problems.push({
						path,
						message: `imports ${specifier}; UI files may only import .svelte, .ts and .js files`,
						hint:
							UI_IMPORT_HINTS[extension] ??
							'Pouchbase only links .svelte and .js files of the plugin.'
					});
				} else {
					if (!importers.has(resolved)) {
						importers.set(resolved, path);
					}

					queue.push(resolved);
				}
			}
		}

		uiFiles[uiBundlePath(path)] = source;
		uiSources[uiBundlePath(path)] = path;
	}

	if (problems.length) {
		fail(problems, 'Problems in the UI files');
	}

	return { uiFiles, uiSources, compiled };
}
