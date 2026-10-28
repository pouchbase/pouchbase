/**
 * Reading a plugin's settings: the values the host passes to the plugin and `ctx.settings`. Only
 * types are imported, so it bundles into the sandboxed server code as is.
 */

import type { PluginSettingDefinition, PluginSettings } from './server.js';
import type { PluginSetting } from './settings-schema.js';

/**
 * The values of the settings as strings, as the host passes them to the plugin: for each setting
 * of the manifest the saved value, else its default as a string (`'42'`, `'true'`); settings with
 * neither are left out (`get` returns `null`). Saved values of keys the manifest no longer has
 * are left out too. `ctx.settings.get(key)` parses them by type (`parseSettingValue`).
 */
export function resolveSettings(
	settings: readonly Pick<PluginSetting, 'key' | 'default'>[] | undefined,
	saved: Readonly<Record<string, string>>
): Record<string, string> {
	const values: Record<string, string> = {};

	for (const setting of settings ?? []) {
		if (Object.hasOwn(saved, setting.key)) {
			values[setting.key] = saved[setting.key]!;
		} else if (setting.default !== undefined) {
			values[setting.key] = String(setting.default);
		}
	}

	return values;
}

/**
 * A saved value (always a string, as `plugin_settings` stores it) as `ctx.settings.get` returns it:
 * a number for `number`, a boolean for `boolean`, the string for the other types. Without a value
 * (`raw` `null` or `undefined`) the setting's `default`, else `null`; so is a value that doesn't
 * parse (a `number` that isn't one).
 */
export function parseSettingValue(
	setting: Pick<PluginSettingDefinition, 'type' | 'default'>,
	raw: string | null | undefined
): string | number | boolean | null {
	if (raw === null || raw === undefined) {
		return setting.default ?? null;
	}

	switch (setting.type) {
		case 'number': {
			const number = raw.trim() ? Number(raw) : Number.NaN;

			return Number.isFinite(number) ? number : (setting.default ?? null);
		}
		case 'boolean':
			return raw === 'true';
		default:
			return raw;
	}
}

/**
 * `ctx.settings` for the setting definitions and their values (`key` → string): the host builds
 * the plugin context with it, and so can tests. Keys without a definition read as `null`.
 */
export function createPluginSettings(
	definitions: readonly Pick<PluginSettingDefinition, 'key' | 'type' | 'default'>[] | undefined,
	values: Readonly<Record<string, string>> = {}
): PluginSettings {
	const all = () =>
		Object.fromEntries(
			(definitions ?? []).map((setting) => [
				setting.key,
				parseSettingValue(
					setting,
					Object.hasOwn(values, setting.key) ? values[setting.key] : undefined
				)
			])
		);

	return {
		get: async (key: string) => {
			const current = all();

			return Object.hasOwn(current, key) ? current[key] : null;
		},
		getAll: async () => all()
	} as PluginSettings;
}
