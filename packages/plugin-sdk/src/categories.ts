import type { ManifestIssue, PluginManifest } from './manifest.js';

/**
 * Categories group plugins in the registry and on the Plugins page. The list is fixed: a plugin
 * declares up to three in its manifest, and the CLI and the registry reject unknown ones. Hosts
 * only check the pattern, so a manifest with a category added in a later SDK still installs.
 */

export const PLUGIN_CATEGORIES = [
	'auth',
	'fields',
	'pages',
	'integrations',
	'developer-tools'
] as const;

export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];

/** Names to show for each category. */
export const PLUGIN_CATEGORY_LABELS: Record<PluginCategory, string> = {
	auth: 'Sign-in providers',
	fields: 'Field types',
	pages: 'Pages',
	integrations: 'Integrations',
	'developer-tools': 'Developer tools'
};

/** `auth`, `developer-tools`: lowercase words separated by dashes. */
export const CATEGORY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The maximum number of categories a manifest declares. */
export const MAX_CATEGORIES = 3;

export function isPluginCategory(value: unknown): value is PluginCategory {
	return typeof value === 'string' && (PLUGIN_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Issues for the categories that aren't in `PLUGIN_CATEGORIES`, with paths like `categories.1`.
 * The CLI and the registry use it; hosts don't, so they accept categories added later.
 */
export function unknownCategoryIssues(categories: readonly string[]): ManifestIssue[] {
	return categories.flatMap((category, index) =>
		isPluginCategory(category)
			? []
			: [
					{
						path: `categories.${index}`,
						message: `Unknown category: ${category}; use one of ${PLUGIN_CATEGORIES.join(', ')}`
					}
				]
	);
}

/**
 * The categories a plugin is listed under: the declared ones, or else those that follow from what
 * it contributes (`auth` for auth providers, `fields` for field types, `pages` for pages).
 */
export function effectiveCategories(
	manifest: Pick<PluginManifest, 'categories'> & {
		contributes: Partial<Pick<PluginManifest['contributes'], 'authProviders' | 'fields' | 'pages'>>;
	}
): string[] {
	if (manifest.categories.length) {
		return manifest.categories;
	}

	const { authProviders, fields, pages } = manifest.contributes;
	const categories: PluginCategory[] = [];

	if (authProviders?.length) {
		categories.push('auth');
	}

	if (fields?.length) {
		categories.push('fields');
	}

	if (pages?.length) {
		categories.push('pages');
	}

	return categories.slice(0, MAX_CATEGORIES);
}
