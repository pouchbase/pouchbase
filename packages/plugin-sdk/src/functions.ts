import { z } from 'zod';

/**
 * The functions a plugin contributes (`contributes.functions` of the manifest). They are functions
 * like those on the Functions page, called through `/api/functions/<name>`, but their code runs in
 * the plugin's Worker with the plugin's permissions, and it changes only with the plugin.
 */

/** Lowercase letters, digits and dashes, not at the ends: part of a URL. */
export const FUNCTION_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Longest function name a host accepts, the plugin's prefix included. */
export const MAX_FUNCTION_NAME_LENGTH = 40;

/**
 * The host's name of a plugin's function: the plugin id, a `-` and the name
 * (`pluginFunctionName('cms', 'get-posts')` is `cms-get-posts`). The prefix keeps them apart from
 * the app's functions and those of other plugins.
 */
export function pluginFunctionName(pluginId: string, name: string): string {
	return `${pluginId}-${name}`;
}

export const functionContributionSchema = z.object({
	/** Without the prefix: `get-posts` becomes `<plugin>-get-posts`. */
	name: z
		.string()
		.regex(FUNCTION_NAME_PATTERN, 'Use lowercase letters, numbers and dashes, not at the ends'),
	/** One sentence, shown on the Functions page and in the generated types. */
	description: z.string().trim().min(1).max(200).optional(),
	/** Whether callers must be signed in as an app user; without it, anyone may call the function. */
	requireAuth: z.boolean().default(false)
});

export type FunctionContribution = z.output<typeof functionContributionSchema>;
