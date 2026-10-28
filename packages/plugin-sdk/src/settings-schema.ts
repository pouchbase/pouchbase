import { z } from 'zod';

/**
 * The settings in a manifest: what an admin can set for a plugin on the Plugins page. The CLI
 * fills them in from `definePlugin({ settings })` in `plugin.ts`; `settings.ts` reads the values.
 */

/** `api_key`, `region`: a setting's key, as `ctx.settings.get(key)` reads it. */
export const SETTING_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * How a setting is entered and checked: `text` and `url` (an absolute URL) are strings, `number`
 * and `boolean` are typed in the form, `secret` is a string that is never shown again once saved.
 * Values are stored as strings (`'42'`, `'true'`); `ctx.settings.get(key)` parses them by type
 * (`parseSettingValue` in `@pouchbasejs/plugin-sdk/server`).
 */
export const PLUGIN_SETTING_TYPES = ['text', 'secret', 'number', 'boolean', 'url'] as const;

/** Most settings a plugin can have. */
const MAX_PLUGIN_SETTINGS = 30;

/** Why `value` can't be the default of a setting of `type`, or `null` when it can. */
function settingDefaultProblem(
	type: (typeof PLUGIN_SETTING_TYPES)[number],
	value: string | number | boolean | undefined
): string | null {
	if (value === undefined) {
		return null;
	}

	switch (type) {
		case 'secret':
			return 'A secret setting has no default';
		case 'number':
			return typeof value === 'number' && Number.isFinite(value) ? null : 'Must be a number';
		case 'boolean':
			return typeof value === 'boolean' ? null : 'Must be true or false';
		case 'url':
			return typeof value === 'string' && URL.canParse(value) ? null : 'Must be an absolute URL';
		default:
			return typeof value === 'string' ? null : 'Must be a string';
	}
}

const pluginSettingSchema = z
	.object({
		key: z.string().regex(SETTING_KEY_PATTERN, 'Use lowercase letters, numbers and underscores'),
		label: z.string().trim().min(1).max(64),
		description: z.string().trim().min(1).max(200).optional(),
		type: z.enum(PLUGIN_SETTING_TYPES).default('text'),
		/** The plugin can't work without it; an admin is asked to fill it in. */
		required: z.boolean().default(false),
		/** Used while no value is saved; of the setting's type, not for `secret`. */
		default: z.union([z.string().max(2000), z.number(), z.boolean()]).optional()
	})
	.superRefine((setting, ctx) => {
		const problem = settingDefaultProblem(setting.type, setting.default);

		if (problem) {
			ctx.addIssue({ code: 'custom', path: ['default'], message: problem });
		}
	});

/**
 * The settings of a plugin: at most `MAX_PLUGIN_SETTINGS`, with unique keys. The manifest carries
 * them; the CLI fills them in from `definePlugin({ settings })` in `plugin.ts`.
 */
export const pluginSettingsSchema = z
	.array(pluginSettingSchema)
	.max(MAX_PLUGIN_SETTINGS)
	.superRefine((settings, ctx) => {
		settings.forEach((setting, index) => {
			if (settings.findIndex((other) => other.key === setting.key) !== index) {
				ctx.addIssue({
					code: 'custom',
					path: [index, 'key'],
					message: `Duplicate key: ${setting.key}`
				});
			}
		});
	});

export type PluginSetting = z.output<typeof pluginSettingSchema>;

export type PluginSettingType = (typeof PLUGIN_SETTING_TYPES)[number];
