import { PLUGIN_CATEGORIES, PLUGIN_ID_PATTERN } from '@pouchbasejs/plugin-sdk';
import { z } from 'zod';

export const pluginIdSchema = z.object({ id: z.string().regex(PLUGIN_ID_PATTERN) });

export const searchPluginsSchema = z.object({
	query: z.string().trim().max(100),
	page: z.number().int().positive(),
	/** Only plugins in this category. */
	category: z.enum(PLUGIN_CATEGORIES).optional()
});

const settingValue = z.string().trim().max(2000);

/**
 * The settings form of a plugin. The fields are built from the plugin's settings, grouped by how
 * the form sends them: `values` for text and URL settings, `numbers`, `flags` for booleans (an
 * unchecked box is left out) and `_secrets`, which are never sent back; an empty secret keeps the
 * saved one.
 */
export const pluginSettingsSchema = z.object({
	id: z.string().regex(PLUGIN_ID_PATTERN),
	values: z.record(z.string(), settingValue).default({}),
	numbers: z.record(z.string(), z.number().optional()).default({}),
	flags: z.record(z.string(), z.boolean().optional()).default({}),
	_secrets: z.record(z.string(), settingValue).default({})
});
