import type { ManifestIssue } from '../manifest.js';
import type { Logger } from './output.js';

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { compile } from 'tailwindcss';

import { UI_DIR } from '../manifest.js';
import { count, kib } from './format.js';

/**
 * Tailwind for plugins: the classes a plugin's components use, compiled into one stylesheet of the
 * bundle, which the host loads with the plugin like every other `.css` file in `ui/`. Only the
 * theme and the utilities: the dashboard already has Tailwind's base styles (preflight), and the
 * output goes into the same `theme` and `utilities` layers, so a class means what it means in the
 * dashboard. The theme is Tailwind's default with the dashboard's tokens on top
 * (`@pouchbasejs/ui/tokens.css`: `h-control`, `h-row`, the chart colours, ...).
 */

/** Bundle path of the generated stylesheet. */
export const TAILWIND_FILE = `${UI_DIR}/tailwind.css`;

const TOKENS = '@pouchbasejs/ui/tokens.css';

/** Files whose class names are read; TypeScript is already `.js` in the bundle. */
const SCANNED = /\.(?:svelte|js)$/;

/**
 * Every word of the source that could be a class: Tailwind ignores the ones that aren't, so this
 * may find too many but never too few. Splits on whitespace, quotes and braces, so `class="a b"`,
 * `class={['a', ok && 'b']}` and `` `a ${b}` `` all give their classes; `class:a={ok}` gives `a`.
 */
export function classCandidates(source: string): Set<string> {
	const candidates = new Set<string>();

	for (const word of source.split(/[\s"'`{}<>\\]+/)) {
		const trimmed = word.replace(/^class:/, '').replace(/^[,;(]+|[,;=]+$/g, '');

		for (const candidate of [word, trimmed]) {
			if (candidate && candidate.length < 200) {
				candidates.add(candidate);
			}
		}
	}

	return candidates;
}

/**
 * The stylesheet for the classes in `files` (bundle path → contents), or `css: null` when they use
 * none. `root` is the plugin project, where `@pouchbasejs/ui` is looked up; without it the classes
 * still compile, with Tailwind's default theme only, and `warnings` says so.
 */
export async function compileTailwind(
	root: string,
	files: Record<string, string>,
	{ log }: { log?: Logger } = {}
): Promise<{ css: string | null; classes: number; warnings: ManifestIssue[] }> {
	const sources = Object.entries(files).filter(([path]) => SCANNED.test(path));

	if (!sources.length) {
		return { css: null, classes: 0, warnings: [] };
	}

	log?.step('Compiling the Tailwind classes');

	const sdk = createRequire(import.meta.url);
	const project = createRequire(join(resolve(root), 'package.json'));
	const warnings: ManifestIssue[] = [];
	let tokens: string | null = null;

	try {
		tokens = project.resolve(TOKENS);
	} catch {
		warnings.push({
			path: 'package.json',
			message: `Tailwind classes use the default theme: add @pouchbasejs/ui 0.2 or later as a devDependency for the dashboard's tokens (h-control, h-row, ...)`
		});
	}

	const input = [
		'@layer theme, base, components, utilities;',
		"@import 'tailwindcss/theme.css' layer(theme);",
		"@import 'tailwindcss/utilities.css' layer(utilities);",
		tokens ? `@import '${TOKENS}';` : ''
	].join('\n');

	const compiler = await compile(input, {
		base: root,
		async loadStylesheet(id, base) {
			const path =
				id === TOKENS && tokens
					? tokens
					: id.startsWith('tailwindcss/')
						? sdk.resolve(id)
						: resolve(base, id);

			return { path, base: dirname(path), content: await readFile(path, 'utf8') };
		}
	});

	const candidates = new Set<string>();

	for (const [, source] of sources) {
		for (const candidate of classCandidates(source)) {
			candidates.add(candidate);
		}
	}

	const empty = compiler.build([]);
	const css = compiler.build([...candidates]);

	if (css === empty) {
		log?.detail('No Tailwind classes');

		return { css: null, classes: 0, warnings };
	}

	// Each class is one rule in the output; its selector starts with a dot at the start of a line.
	const classes = new Set(css.match(/^\s*\.[^\s{,]+/gm)?.map((selector) => selector.trim())).size;

	log?.detail(
		`${count(classes, 'class', 'classes')}, ${kib(new TextEncoder().encode(css).length)}`
	);

	return { css, classes, warnings };
}
