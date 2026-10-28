import type { PluginManifest } from '@pouchbasejs/plugin-sdk';
import type { CompiledUi } from './compile';

import { UI_DIR } from '@pouchbasejs/plugin-sdk';

import { pluginModules } from '../db';
import { compileUi, formatCompileIssue } from './compile';
import { causeOf, fail } from './errors';

/**
 * The compiled UI of an installed plugin: compiled on install (`compile.ts`), stored in
 * `plugin_modules` per version and served to the dashboard's module loader as `PluginModules`.
 * Built-in plugins have none: their components come with the dashboard.
 */

/** The compiled UI of an installed plugin, for the dashboard's module loader. */
export type PluginModules = {
	version: string;
	/** Bundle path → ES module and the specifiers it imports (host modules and bundle paths). */
	modules: Record<string, { code: string; imports: string[] }>;
	/** Contents of the plugin's `.css` files, by path. */
	css: string[];
};

export type ModuleRow = typeof pluginModules.$inferInsert;

/** Rows of `plugin_modules` per insert; D1 binds at most 100 values per statement. */
export const MODULE_ROWS_PER_INSERT = 15;

export function chunks<T>(items: readonly T[], size: number): T[][] {
	const result: T[][] = [];

	for (let start = 0; start < items.length; start += size) {
		result.push(items.slice(start, start + size));
	}

	return result;
}

/** Compiles the UI files of a bundle; fails with `UI_COMPILE_FAILED` when one doesn't compile. */
export async function compileBundle(files: Record<string, string>): Promise<CompiledUi> {
	let ui: CompiledUi;

	try {
		ui = await compileUi(files);
	} catch (error) {
		return fail(
			{
				code: 19014,
				message: 'UI_COMPILE_FAILED',
				data: { issues: [{ path: UI_DIR, message: causeOf(error) }] }
			},
			error
		);
	}

	if (ui.issues.length) {
		fail(
			{ code: 19014, message: 'UI_COMPILE_FAILED', data: { issues: ui.issues } },
			ui.issues.map(formatCompileIssue).join('\n')
		);
	}

	return ui;
}

/** The rows of `plugin_modules` for a compiled UI. */
export function moduleRows(manifest: PluginManifest, ui: CompiledUi, updatedAt: Date): ModuleRow[] {
	return [
		...Object.entries(ui.modules).map(([path, module]) => ({
			pluginId: manifest.id,
			path,
			version: manifest.version,
			code: module.code,
			imports: module.imports,
			updatedAt
		})),
		...Object.entries(ui.css).map(([path, code]) => ({
			pluginId: manifest.id,
			path,
			version: manifest.version,
			code,
			imports: [],
			updatedAt
		}))
	];
}

/** The stored rows of a version as the module loader takes them. */
export function toModules(
	version: string,
	rows: Pick<ModuleRow, 'path' | 'code' | 'imports'>[]
): PluginModules {
	const result: PluginModules = { version, modules: {}, css: [] };

	for (const module of [...rows].sort((a, b) => a.path.localeCompare(b.path))) {
		if (module.path.endsWith('.css')) {
			result.css.push(module.code);
		} else {
			result.modules[module.path] = { code: module.code, imports: module.imports };
		}
	}

	return result;
}
