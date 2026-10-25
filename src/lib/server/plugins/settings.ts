import type { PluginSetting } from '@pouchbasejs/plugin-sdk';

/**
 * The settings of a plugin (`manifest.settings`) as an admin fills them in on the Plugins page.
 * Values are stored as strings in `plugin_settings` (`'42'`, `'true'`); `resolveSettings` adds the
 * defaults, and `ctx.settings.get(key)` parses them by type (`parseSettingValue` of the SDK).
 * Secret values are never sent back to the dashboard once saved.
 */

/** A setting's value for the dashboard: secrets come back as `value: null`. */
export type PluginSettingValue = {
	/** The saved value, else the default as a string; always `null` for a secret. */
	value: string | null;
	/** Whether a value is saved (for a secret: whether it is filled in). */
	set: boolean;
};

export type PluginSettingsState = {
	definition: PluginSetting[];
	values: Record<string, PluginSettingValue>;
	/** Keys of required settings that have neither a saved value nor a default. */
	missing: string[];
};

/** Longest value of a setting. */
const MAX_VALUE_LENGTH = 2000;

/** Keys of the required settings without a saved value or a default. */
export function missingSettings(
	definition: readonly PluginSetting[],
	saved: Readonly<Record<string, string>>
): string[] {
	return definition
		.filter(
			(setting) =>
				setting.required && !Object.hasOwn(saved, setting.key) && setting.default === undefined
		)
		.map((setting) => setting.key);
}

/** What the dashboard gets for the saved values: secrets masked, defaults filled in. */
export function settingsState(
	definition: readonly PluginSetting[],
	saved: Readonly<Record<string, string>>
): PluginSettingsState {
	const values: Record<string, PluginSettingValue> = {};

	for (const setting of definition) {
		const set = Object.hasOwn(saved, setting.key);

		values[setting.key] = {
			value:
				setting.type === 'secret'
					? null
					: set
						? saved[setting.key]!
						: setting.default === undefined
							? null
							: String(setting.default),
			set
		};
	}

	return { definition: [...definition], values, missing: missingSettings(definition, saved) };
}

/** The value to store for `input` of a setting, or why it isn't valid. */
function normalise(setting: PluginSetting, input: string): { value: string } | { message: string } {
	if (input.length > MAX_VALUE_LENGTH) {
		return { message: `Use at most ${MAX_VALUE_LENGTH} characters` };
	}

	switch (setting.type) {
		case 'number': {
			const number = Number(input.trim());

			return input.trim() && Number.isFinite(number)
				? { value: String(number) }
				: { message: 'Enter a number' };
		}
		case 'boolean': {
			const lower = input.trim().toLowerCase();

			if (['true', '1', 'on', 'yes'].includes(lower)) {
				return { value: 'true' };
			}

			if (['false', '0', 'off', 'no'].includes(lower)) {
				return { value: 'false' };
			}

			return { message: 'Must be true or false' };
		}
		case 'url': {
			const value = input.trim();
			const url = URL.canParse(value) ? new URL(value) : null;

			return url && (url.protocol === 'https:' || url.protocol === 'http:')
				? { value }
				: { message: 'Enter an absolute URL, e.g. https://example.com' };
		}
		default:
			return { value: input };
	}
}

/**
 * The values to store after an admin saved `input`: `undefined` keeps the saved value (an
 * untouched secret), `null` or `''` clears it (the default applies again). Keys the manifest
 * doesn't have are ignored, and so are saved values of keys it no longer has. `issues` holds a
 * message per key that isn't valid, including required settings left without a value.
 */
export function applySettings(
	definition: readonly PluginSetting[],
	saved: Readonly<Record<string, string>>,
	input: Readonly<Record<string, string | null | undefined>>
): { values: Record<string, string>; issues: Record<string, string> } {
	const values: Record<string, string> = {};
	const issues: Record<string, string> = {};

	for (const setting of definition) {
		const value = Object.hasOwn(input, setting.key) ? input[setting.key] : undefined;

		if (value === undefined) {
			if (Object.hasOwn(saved, setting.key)) {
				values[setting.key] = saved[setting.key]!;
			}
		} else if (value !== null && value !== '') {
			const result = normalise(setting, value);

			if ('message' in result) {
				issues[setting.key] = result.message;
				continue;
			}

			values[setting.key] = result.value;
		}

		if (setting.required && !Object.hasOwn(values, setting.key) && setting.default === undefined) {
			issues[setting.key] = 'Required';
		}
	}

	return { values, issues };
}
