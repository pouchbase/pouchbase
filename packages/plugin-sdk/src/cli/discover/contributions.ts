import type { IconResolver } from './icons.js';
import type { Problem } from './problems.js';

import {
	authProviderContributionSchema,
	fieldContributionSchema,
	pageContributionSchema,
	type AuthProviderContribution,
	type FieldContribution,
	type PageContribution
} from '../../manifest.js';
import { collectionContributionSchema, type CollectionContribution } from '../../collections.js';
import { pluginFilePath } from '../../server.js';
import { isObject, missingProviderMembers } from '../project.js';
import { ROUTE_METHODS } from '../server-entry.js';
import { title } from '../templates/index.js';
import { lowercaseHint, routePathProblem } from './ids.js';
import { uiBundlePath } from './ui-files.js';

/**
 * Checking what `definePlugin({ ... })` adds, kind by kind, and turning it into the
 * contributions of the manifest. Every function adds what is wrong to `scope.problems` and skips
 * that entry, so one run reports every problem.
 */

/** What `definePlugin({ ... })` can have. */
export const DEFINITION_KEYS = [
	'settings',
	'fields',
	'pages',
	'authProviders',
	'collections',
	'routes'
] as const;

/** A component that `plugin.ts` names: its path, and where in the definition it is. */
export type FileUse = { path: string; where: string };

/** What the checks read and collect while going through `definePlugin({ ... })`. */
export type DefinitionScope = {
	/** The default export of `plugin.ts`. */
	definition: Record<string, unknown>;
	/** `plugin.ts` or `plugin.js`, the path of every problem. */
	file: string;
	problems: Problem[];
	icons: IconResolver;
	/** The components the contributions name, for the UI files. */
	components: FileUse[];
};

/** The definition's `key` as a record by id; a problem when it's something else. */
function recordOf(
	{ definition, file, problems }: DefinitionScope,
	key: (typeof DEFINITION_KEYS)[number]
): [string, unknown][] {
	const value = definition[key];

	if (value === undefined) {
		return [];
	}

	if (!isObject(value) || Array.isArray(value)) {
		problems.push({
			path: file,
			message: `${key} must be an object by id, e.g. ${key}: { ${key === 'routes' ? "'/items': items" : 'rating'} }`
		});

		return [];
	}

	return Object.entries(value);
}

/** `fields.rating`, `routes['/items/:id']`: where a value is in the definition, for messages. */
function at(key: string, id: string) {
	return /^[A-Za-z_$][\w$]*$/.test(id) ? `${key}.${id}` : `${key}[${JSON.stringify(id)}]`;
}

/** The component at `where`, an imported `.svelte` file; `null` after a problem. */
function component(
	{ file, problems }: DefinitionScope,
	value: unknown,
	where: string,
	example: string
): FileUse | null {
	const path = pluginFilePath(value);

	if (path === null || !path.endsWith('.svelte')) {
		problems.push({
			path: file,
			message:
				value === undefined
					? `${where} is missing: a Svelte component of the plugin, e.g. ${example}`
					: `${where} must be a Svelte component of the plugin, imported like a module: ${example}`
		});

		return null;
	}

	return { path, where };
}

/** Field types: `fields: { rating }`. */
export async function fieldContributions(scope: DefinitionScope): Promise<FieldContribution[]> {
	const { file, problems, icons, components } = scope;
	const contributions: FieldContribution[] = [];

	for (const [type, field] of recordOf(scope, 'fields')) {
		const where = at('fields', type);

		if (!fieldContributionSchema.shape.type.safeParse(type).success) {
			problems.push({
				path: file,
				message: `${where}: ${lowercaseHint(type) ?? `"${type}" can't be a field type; use lowercase letters, numbers and underscores, e.g. rating`}`
			});
			continue;
		}

		if (!isObject(field)) {
			problems.push({ path: file, message: `${where} must be defineField({ ... })` });
			continue;
		}

		const input = component(
			scope,
			field.input,
			`${where}.input`,
			"import Input from './input.svelte'"
		);
		const preview =
			field.preview === undefined
				? null
				: component(
						scope,
						field.preview,
						`${where}.preview`,
						"import Preview from './preview.svelte'"
					);
		const icon = await icons.contributionIcon(field.icon, `${where}.icon`);

		if (!input || (field.preview !== undefined && !preview)) {
			continue;
		}

		components.push(input, ...(preview ? [preview] : []));

		const result = fieldContributionSchema.safeParse({
			type,
			label: field.label ?? title(type),
			description: field.description,
			column: field.column,
			input: uiBundlePath(input.path),
			...(preview ? { preview: uiBundlePath(preview.path) } : {}),
			...(icon ? { icon } : {})
		});

		if (!result.success) {
			for (const issue of result.error.issues) {
				const key = issue.path.join('.');

				problems.push({
					path: file,
					message:
						key === 'description' && field.description === undefined
							? `${where} needs a description: one sentence shown when an admin picks the type`
							: key === 'column' && field.column === undefined
								? `${where} needs a column: TEXT, INTEGER, REAL or BLOB, the storage class of the value`
								: `${where}.${key}: ${issue.message}`
				});
			}

			continue;
		}

		contributions.push(result.data);
	}

	return contributions;
}

/** Pages: `pages: { stats: { title, icon, component } }`, in this order. */
export async function pageContributions(scope: DefinitionScope): Promise<PageContribution[]> {
	const { file, problems, icons, components } = scope;
	const contributions: PageContribution[] = [];

	for (const [path, page] of recordOf(scope, 'pages')) {
		const where = at('pages', path);

		if (!pageContributionSchema.shape.path.safeParse(path).success) {
			problems.push({
				path: file,
				message: `${where}: ${lowercaseHint(path) ?? `"${path}" can't be a page path; use lowercase words separated by dashes, with slashes between segments, e.g. reports/monthly`}`
			});
			continue;
		}

		if (!isObject(page)) {
			problems.push({
				path: file,
				message: `${where} must be a page, e.g. { title: 'Stats', component: Stats }`
			});
			continue;
		}

		const use = component(
			scope,
			page.component,
			`${where}.component`,
			"import Stats from './stats.svelte'"
		);
		const icon = await icons.contributionIcon(page.icon, `${where}.icon`);

		if (!use) {
			continue;
		}

		components.push(use);

		const result = pageContributionSchema.safeParse({
			path,
			title: page.title ?? title(path),
			component: uiBundlePath(use.path),
			...(page.navigation !== undefined ? { navigation: page.navigation } : {}),
			...(page.layout !== undefined ? { layout: page.layout } : {}),
			...(icon ? { icon } : {})
		});

		if (!result.success) {
			problems.push(
				...result.error.issues.map((issue) => ({
					path: file,
					message: `${where}.${issue.path.join('.')}: ${issue.message}`
				}))
			);
			continue;
		}

		contributions.push(result.data);
	}

	return contributions;
}

/** Auth providers: `authProviders: { gitlab }`. */
export async function authProviderContributions(
	scope: DefinitionScope
): Promise<AuthProviderContribution[]> {
	const { file, problems, icons } = scope;
	const contributions: AuthProviderContribution[] = [];

	for (const [id, provider] of recordOf(scope, 'authProviders')) {
		const where = at('authProviders', id);
		const idResult = authProviderContributionSchema.shape.id.safeParse(id);

		if (!idResult.success) {
			problems.push({
				path: file,
				message: `${where}: ${lowercaseHint(id) ?? `"${id}" can't be a provider id: ${idResult.error.issues[0]?.message ?? 'invalid'}`}`
			});
			continue;
		}

		if (!isObject(provider)) {
			problems.push({ path: file, message: `${where} must be defineAuthProvider({ ... })` });
			continue;
		}

		const missing = missingProviderMembers(provider);

		if (missing.length) {
			problems.push({ path: file, message: `${where} lacks ${missing.join(', ')}` });
			continue;
		}

		const icon = await icons.contributionIcon(provider.icon, `${where}.icon`, true);
		const result = authProviderContributionSchema.safeParse({
			id,
			label: provider.label ?? title(id),
			...(provider.consoleUrl !== undefined ? { consoleUrl: provider.consoleUrl } : {}),
			...(icon ? { icon } : {})
		});

		if (!result.success) {
			problems.push(
				...result.error.issues.map((issue) => ({
					path: file,
					message: `${where}.${issue.path.join('.')}: ${issue.message}`
				}))
			);
			continue;
		}

		contributions.push(result.data);
	}

	return contributions;
}

/** Collections: `collections: { reviews: { fields: [...] } }`. */
export function collectionContributions(scope: DefinitionScope): CollectionContribution[] {
	const { file, problems } = scope;
	const contributions: CollectionContribution[] = [];

	for (const [name, collection] of recordOf(scope, 'collections')) {
		const where = at('collections', name);

		if (!isObject(collection)) {
			problems.push({
				path: file,
				message: `${where} must be defineCollection({ fields: [...] })`
			});
			continue;
		}

		const result = collectionContributionSchema.safeParse({ ...collection, name });

		if (!result.success) {
			problems.push(
				...result.error.issues.map((issue) => ({
					path: file,
					message:
						issue.path[0] === 'name'
							? `${where}: ${lowercaseHint(name) ?? `"${name}" can't be a collection name; ${issue.message.toLowerCase()}, e.g. reviews`}`
							: `${where}.${issue.path.join('.')}: ${issue.message}`
				}))
			);
			continue;
		}

		contributions.push(result.data);
	}

	return contributions;
}

/** Routes: `routes: { '/items/:id': items }`, a handler per method; their keys, e.g. `GET /items/:id`. */
export function definitionRoutes(scope: DefinitionScope): string[] {
	const { file, problems } = scope;
	const routes: string[] = [];
	const shapes = new Map<string, string>();

	for (const [path, module] of recordOf(scope, 'routes')) {
		const where = at('routes', path);
		const problem = routePathProblem(path);

		if (problem !== null) {
			problems.push({ path: file, message: `${where}: ${problem}` });
			continue;
		}

		// `/items/:id` and `/items/:slug` answer the same requests.
		const shape = path.replace(/:[^/]+/g, ':');
		const other = shapes.get(shape);

		if (other !== undefined) {
			problems.push({
				path: file,
				message: `${where} answers the same paths as ${at('routes', other)}; keep one of them`
			});
			continue;
		}

		shapes.set(shape, path);

		const methods = isObject(module)
			? ROUTE_METHODS.filter((method) => typeof module[method] === 'function')
			: [];

		if (!methods.length) {
			problems.push({
				path: file,
				message: `${where} has no ${ROUTE_METHODS.join(', ')} handler`,
				hint: "A route is a handler per method: import * as items from './routes/items.js' for a module with export const GET: RouteHandler = ..., or { GET: (request, ctx) => Response.json({ ok: true }) }."
			});
			continue;
		}

		routes.push(...methods.map((method) => `${method} ${path}`));
	}

	return routes;
}
