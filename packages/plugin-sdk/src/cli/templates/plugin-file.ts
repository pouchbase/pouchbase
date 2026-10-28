import type { PluginSettingType } from '../../settings-schema.js';
import { entrySource, type PluginEntry } from './entries.js';
import { indented, quote } from './source.js';

/** `plugin.ts`: the settings and the record of every contribution in `definePlugin({ ... })`. */

/** The file that default-exports `definePlugin({ ... })`. */
export const PLUGIN_FILE = 'plugin.ts';

/** A setting as `add setting` and the templates write it. */
export type SettingTemplate = {
	key: string;
	label: string;
	description?: string;
	type: PluginSettingType;
	default?: string | number | boolean;
};

/** A setting as an object literal; `indent` is the indentation of its braces. */
export function settingSource(setting: SettingTemplate, indent = '\t\t') {
	const lines = [
		`key: ${quote(setting.key)}`,
		`label: ${quote(setting.label)}`,
		...(setting.description !== undefined ? [`description: ${quote(setting.description)}`] : []),
		`type: ${quote(setting.type)}`,
		...(setting.default === undefined
			? []
			: [
					`default: ${typeof setting.default === 'string' ? quote(setting.default) : String(setting.default)}`
				])
	];

	return `{\n${lines.map((line) => `${indent}\t${line}`).join(',\n')}\n${indent}}`;
}

/**
 * `plugin.ts` with `settings` and `entries`, and the `Register` block that types
 * `ctx.settings.get(key)` in the routes, field types and auth providers of the plugin.
 */
export function pluginFileSource(
	settings: readonly SettingTemplate[],
	entries: readonly PluginEntry[] = []
) {
	const properties: string[] = [];

	if (settings.length) {
		properties.push(
			`settings: [\n${settings.map((setting) => `\t\t${settingSource(setting)}`).join(',\n')}\n\t]`
		);
	}

	for (const key of ['fields', 'pages', 'authProviders', 'routes'] as const) {
		const records = entries.filter((entry) => entry.key === key);

		if (records.length) {
			properties.push(
				`${key}: {\n${records.map((entry) => `\t\t${indented(entrySource(entry), '\t\t')}`).join(',\n')}\n\t}`
			);
		}
	}

	const imports = entries.flatMap((entry) => entry.imports);

	return `import { definePlugin } from '@pouchbasejs/plugin-sdk/server';
${imports.length ? `\n${imports.join('\n')}\n` : ''}
/**
 * The plugin: everything it adds, by id. Settings are filled in by an admin on the Plugins page and
 * read with \`await ctx.settings.get(key)\` (a number setting comes back as a number, a boolean
 * setting as a boolean, the others as strings; \`null\` while there is no value, unless the setting
 * has a default). \`pouchbase-plugin add field|page|auth-provider|route|setting <id>\` adds one.
 */
const plugin = definePlugin({${properties.length ? `\n\t${properties.join(',\n\t')}\n` : ''}});

export default plugin;

// Types ctx.settings.get(key) everywhere in the plugin, from the settings above.
declare module '@pouchbasejs/plugin-sdk/server' {
	interface Register {
		plugin: typeof plugin;
	}
}
`;
}
