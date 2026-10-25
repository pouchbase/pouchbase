import type { PluginCategory } from '../categories.js';

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseAst } from 'rolldown/parseAst';

import { MAX_CATEGORIES } from '../categories.js';
import {
	MANIFEST_FILE,
	PLUGIN_SETTING_TYPES,
	SETTING_KEY_PATTERN,
	authProviderContributionSchema,
	fieldContributionSchema,
	pageContributionSchema,
	type PluginSettingType
} from '../manifest.js';
import { PLUGIN_FILES, routeFileFor } from './discover.js';
import { ProjectError } from './project-error.js';
import {
	EXAMPLE_PROVIDER_HOST,
	PLUGIN_FILE,
	PROVIDER_ICON,
	authProviderServer,
	conventionFieldFiles,
	conventionPageFiles,
	conventionProviderFiles,
	conventionRouteFiles,
	fieldFiles,
	json,
	objectKey,
	pageFiles,
	pluginFileSource,
	providerIconPath,
	settingSource,
	title,
	type Files,
	type SettingTemplate
} from './templates.js';

/**
 * `pouchbase-plugin add <kind> <id>`: creates the files of a contribution. In the convention
 * layout these files are the contribution, so the manifest only changes for an explicit
 * `categories` list or the example host of an auth provider. In the legacy layout (a manifest with
 * `contributes` or `server`) it also appends the contribution to `pouchbase-plugin.json`. It never
 * overwrites a file; the manifest keeps its key order and is written tab-indented.
 *
 * `add setting <key>` appends a setting to `definePlugin({ settings })` in `plugin.ts`, and creates
 * that file (with the `Register` block that types `ctx.settings`) when the plugin has none; in the
 * legacy layout it appends it to the manifest's `settings`.
 */

export const CONTRIBUTION_KINDS = ['field', 'page', 'auth-provider', 'route', 'setting'] as const;

export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export function isContributionKind(value: string): value is ContributionKind {
	return (CONTRIBUTION_KINDS as readonly string[]).includes(value);
}

/** The kinds of the legacy layout; its routes live in the server code. */
type LegacyKind = Exclude<ContributionKind, 'route' | 'setting'>;

export type AddOptions = {
	/** `add setting`: the setting's type; default `text`. */
	type?: string;
};

const KINDS = {
	field: {
		key: 'fields',
		idKey: 'type',
		category: 'fields',
		schema: fieldContributionSchema.shape.type
	},
	page: {
		key: 'pages',
		idKey: 'path',
		category: 'pages',
		schema: pageContributionSchema.shape.path
	},
	'auth-provider': {
		key: 'authProviders',
		idKey: 'id',
		category: 'auth',
		schema: authProviderContributionSchema.shape.id
	}
} as const satisfies Record<
	LegacyKind,
	{
		key: string;
		idKey: string;
		category: PluginCategory;
		schema: { safeParse(value: unknown): { success: boolean } };
	}
>;

/** Messages for an id that can't be one of its kind. */
const INVALID_ID: Record<ContributionKind, (id: string) => string> = {
	field: (id) =>
		`"${id}" can't be a field type; use lowercase letters, numbers and underscores, e.g. rating`,
	page: (id) =>
		`"${id}" can't be a page path; use lowercase words separated by dashes and slashes, e.g. reports/monthly`,
	'auth-provider': (id) =>
		`"${id}" can't be a provider id; use lowercase words separated by dashes, e.g. gitlab`,
	route: (id) =>
		`"${id}" can't be a route path; use lowercase words separated by slashes, with :name or [name] for a param, e.g. items/:id`,
	setting: (id) =>
		`"${id}" can't be a setting key; use lowercase letters, numbers and underscores, e.g. api_key`
};

/** Where a legacy plugin puts its server code when `add auth-provider` creates it. */
const DEFAULT_SERVER = 'server/index.ts';

export type AddResult = {
	/** Files created, relative to the plugin. */
	created: string[];
	/** Existing files changed, other than the manifest (`plugin.ts` for `add setting`). */
	changed?: string[];
	/** What the author still has to do by hand, e.g. write a handler. */
	hints: string[];
	/** Whether `pouchbase-plugin.json` was written. */
	manifestChanged: boolean;
	layout: 'convention' | 'legacy';
};

type Manifest = Record<string, unknown> & {
	contributes?: Record<string, unknown>;
	settings?: unknown;
	categories?: unknown;
	permissions?: { network?: unknown };
	server?: unknown;
};

async function exists(path: string) {
	return access(path).then(
		() => true,
		() => false
	);
}

async function readManifestJson(root: string): Promise<Manifest> {
	try {
		const parsed: unknown = JSON.parse(await readFile(join(root, MANIFEST_FILE), 'utf8'));

		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('Not a JSON object');
		}

		return parsed as Manifest;
	} catch (error) {
		throw new ProjectError(`Can't read ${MANIFEST_FILE}: ${(error as Error).message}`);
	}
}

/** Adds `category` to an explicit `categories` list; `true` when it changed the manifest. */
function addCategory(manifest: Manifest, category: PluginCategory, hints: string[]): boolean {
	// An explicit list of categories replaces the implied ones, so it should name this one too.
	if (!Array.isArray(manifest.categories) || manifest.categories.includes(category)) {
		return false;
	}

	if (manifest.categories.length < MAX_CATEGORIES) {
		manifest.categories.push(category);

		return true;
	}

	hints.push(`categories is full; consider listing ${category} instead of another category`);

	return false;
}

/** Adds the example provider host to `permissions.network`; `true` when it changed the manifest. */
function addExampleHost(manifest: Manifest): boolean {
	const permissions = (manifest.permissions ??= {});
	const network = Array.isArray(permissions.network) ? permissions.network : [];

	if (network.includes(EXAMPLE_PROVIDER_HOST)) {
		return false;
	}

	permissions.network = [...network, EXAMPLE_PROVIDER_HOST];

	return true;
}

/** Writes `files`, after checking that none of them, and none of `taken`, exists. */
async function writeNewFiles(root: string, files: Files, taken: readonly string[] = []) {
	for (const path of [...taken, ...Object.keys(files)]) {
		if (await exists(join(root, path))) {
			throw new ProjectError(`${path} already exists`);
		}
	}

	for (const [path, contents] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), contents);
	}
}

/** `items/[id]`, `/items/:id` → `/items/:id`. */
function routePath(id: string) {
	const segments = id
		.split('/')
		.filter(Boolean)
		.map((segment) => segment.replace(/^\[(.+)\]$/, ':$1'));

	return `/${segments.join('/')}`;
}

export async function addContribution(
	root: string,
	kind: ContributionKind,
	id: string,
	options: AddOptions = {}
): Promise<AddResult> {
	const manifest = await readManifestJson(root);

	if (kind === 'setting') {
		return addSetting(root, manifest, id, options);
	}

	if (options.type !== undefined) {
		throw new ProjectError(
			'--type is only for add setting',
			[],
			'Run pouchbase-plugin add setting <key> --type <type> to add a setting.'
		);
	}

	if (manifest.contributes === undefined && manifest.server === undefined) {
		return addConvention(root, manifest, kind, id);
	}

	if (kind === 'route') {
		const server = typeof manifest.server === 'string' ? manifest.server : 'the server code';

		throw new ProjectError(
			`add route needs the convention layout; this plugin lists its contributions in ${MANIFEST_FILE}`,
			[],
			`Add "GET ${routePath(id)}" to the routes in ${server}, or move the plugin to the convention layout (fields/, pages/, auth/, routes/) and remove "contributes" and "server" from ${MANIFEST_FILE}.`
		);
	}

	return addLegacy(root, manifest, kind, id);
}

/** The convention layout: the new files are the contribution. */
async function addConvention(
	root: string,
	manifest: Manifest,
	kind: Exclude<ContributionKind, 'setting'>,
	id: string
): Promise<AddResult> {
	const hints: string[] = [];
	let files: Files;
	let taken: string[] = [];
	let changed = false;

	if (kind !== 'route' && !KINDS[kind].schema.safeParse(id).success) {
		throw new ProjectError(INVALID_ID[kind](id));
	}

	switch (kind) {
		case 'field':
			files = conventionFieldFiles(id);
			taken = [`fields/${id}`];
			changed = addCategory(manifest, 'fields', hints);
			hints.push(
				`set the label, description and column in fields/${id}/field.ts; the column can't change once a collection uses the type.`
			);
			break;

		case 'page':
			files = conventionPageFiles(id);
			taken = [`pages/${id}/index.svelte`];
			changed = addCategory(manifest, 'pages', hints);
			break;

		case 'auth-provider':
			files = conventionProviderFiles(id);
			taken = [`auth/${id}`];
			changed = addCategory(manifest, 'auth', hints);
			changed = addExampleHost(manifest) || changed;
			hints.push(
				`replace the example URLs in auth/${id}/provider.ts and ${EXAMPLE_PROVIDER_HOST} in permissions.network with your provider's, and auth/${id}/icon.svg with its logo.`
			);
			break;

		case 'route': {
			const file = routeFileFor(id);

			if (!file) {
				throw new ProjectError(INVALID_ID.route(id));
			}

			const path = routePath(id);

			files = conventionRouteFiles(
				file,
				path,
				typeof manifest.id === 'string' ? manifest.id : null
			);
			// `routes/items.ts` and `routes/items/index.ts` answer the same path.
			taken = file.endsWith('/index.ts') ? [] : [file.replace(/\.ts$/, '/index.ts')];
			hints.push(`export POST, PUT, PATCH or DELETE from ${file} to answer other methods.`);
			break;
		}
	}

	await writeNewFiles(root, files, taken);

	if (changed) {
		await writeFile(join(root, MANIFEST_FILE), json(manifest));
	}

	return { created: Object.keys(files), hints, manifestChanged: changed, layout: 'convention' };
}

/** The legacy layout: the manifest lists the contribution and points to its files. */
async function addLegacy(
	root: string,
	manifest: Manifest,
	kind: LegacyKind,
	id: string
): Promise<AddResult> {
	const { key, idKey, category, schema } = KINDS[kind];

	if (!schema.safeParse(id).success) {
		throw new ProjectError(INVALID_ID[kind](id));
	}

	const contributes = (manifest.contributes ??= {});

	if (typeof contributes !== 'object' || Array.isArray(contributes)) {
		throw new ProjectError(`contributes in ${MANIFEST_FILE} is not an object`);
	}

	const list = (contributes[key] ??= []);

	if (!Array.isArray(list)) {
		throw new ProjectError(`contributes.${key} in ${MANIFEST_FILE} is not a list`);
	}

	if (list.some((item: unknown) => (item as Record<string, unknown>)?.[idKey] === id)) {
		throw new ProjectError(`contributes.${key} already has ${id}`);
	}

	let files: Files;
	const hints: string[] = [];
	const server = typeof manifest.server === 'string' ? manifest.server : null;

	switch (kind) {
		case 'field': {
			const field = fieldFiles(id);

			list.push(field.contribution);
			files = field.files;

			if (server) {
				hints.push(`add fields.${objectKey(id)} to ${server} to validate or convert its values`);
			}

			break;
		}

		case 'page': {
			const page = pageFiles(id);

			list.push(page.contribution);
			files = page.files;
			break;
		}

		case 'auth-provider': {
			list.push({ id, label: title(id), icon: providerIconPath(id) });
			files = { [providerIconPath(id)]: PROVIDER_ICON };

			if (server) {
				hints.push(
					`add authProviders.${objectKey(id)} to ${server} (e.g. with createOidcProvider) and the provider's hosts to permissions.network`
				);
			} else {
				manifest.server = DEFAULT_SERVER;
				files[DEFAULT_SERVER] = authProviderServer(id);
				addExampleHost(manifest);
				hints.push(
					`replace the example URLs in ${DEFAULT_SERVER} and ${EXAMPLE_PROVIDER_HOST} in permissions.network with your provider's`
				);
			}

			break;
		}
	}

	addCategory(manifest, category, hints);
	await writeNewFiles(root, files);

	// New top-level keys such as `server` go before `contributes`, which stays last.
	const rest = Object.entries(manifest).filter(([name]) => name !== 'contributes');

	await writeFile(join(root, MANIFEST_FILE), json({ ...Object.fromEntries(rest), contributes }));

	return { created: Object.keys(files), hints, manifestChanged: true, layout: 'legacy' };
}

// Settings

type AstNode = Record<string, unknown> & { type: string; start: number; end: number };

function isNode(value: unknown): value is AstNode {
	return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';
}

/** Every node of `node`'s tree, depth first. */
function* walk(node: unknown): Generator<AstNode> {
	if (Array.isArray(node)) {
		for (const item of node) {
			yield* walk(item);
		}
	} else if (isNode(node)) {
		yield node;

		for (const [key, value] of Object.entries(node)) {
			if (key !== 'type' && typeof value === 'object') {
				yield* walk(value);
			}
		}
	}
}

/** The name of a non-computed property key: `settings`, `'settings'`. */
function propertyName(property: AstNode): string | undefined {
	const key = property.key as AstNode | undefined;

	if (property.type !== 'Property' || property.computed || !key) {
		return undefined;
	}

	if (key.type === 'Identifier') {
		return key.name as string;
	}

	return typeof key.value === 'string' ? key.value : undefined;
}

/** The indentation of the line `offset` is on. */
function indentationAt(source: string, offset: number) {
	const start = source.lastIndexOf('\n', offset - 1) + 1;

	return /^[ \t]*/.exec(source.slice(start))?.[0] ?? '';
}

/**
 * `source` (a `plugin.ts`) with `setting` appended to the settings of its `definePlugin({ ... })`
 * call; a `ProjectError` when it can't find that call, or the key is taken.
 */
export function appendSetting(file: string, source: string, setting: SettingTemplate): string {
	let program: unknown;

	try {
		program = parseAst(source, { lang: file.endsWith('.ts') ? 'ts' : 'js' }, file);
	} catch (error) {
		throw new ProjectError(`Can't parse ${file}: ${(error as Error).message}`);
	}

	const call = [...walk(program)].find(
		(node) =>
			node.type === 'CallExpression' &&
			(node.callee as AstNode).type === 'Identifier' &&
			(node.callee as AstNode).name === 'definePlugin'
	);
	const definition = (call?.arguments as AstNode[] | undefined)?.[0];
	const hint = `Add it to definePlugin({ settings: [...] }) in ${file} by hand: ${settingSource(setting, '').replace(/\s*\n\s*/g, ' ')}`;

	if (!definition || definition.type !== 'ObjectExpression') {
		throw new ProjectError(`${file} has no definePlugin({ ... }) call`, [], hint);
	}

	const property = (definition.properties as AstNode[]).find(
		(node) => propertyName(node) === 'settings'
	);

	if (!property) {
		// definePlugin({ ... }) without settings: they become its first property.
		const indent = `${indentationAt(source, definition.start)}\t`;
		const at = definition.start + 1;
		const rest = source.slice(at);
		const settings = `\n${indent}settings: [\n${indent}\t${settingSource(setting, `${indent}\t`)}\n${indent}]`;

		// `{}` or `{ }`: nothing follows the settings.
		return /^\s*}/.test(rest)
			? `${source.slice(0, at)}${settings}\n${indentationAt(source, definition.start)}${rest.replace(/^\s*/, '')}`
			: `${source.slice(0, at)}${settings},${rest}`;
	}

	const list = property.value as AstNode;

	if (list.type !== 'ArrayExpression') {
		throw new ProjectError(`settings in ${file} is not a literal list`, [], hint);
	}

	const elements = (list.elements as (AstNode | null)[]).filter(
		(element): element is AstNode => element !== null
	);

	for (const element of elements) {
		const key =
			element.type === 'ObjectExpression'
				? (element.properties as AstNode[]).find((node) => propertyName(node) === 'key')
				: undefined;

		if ((key?.value as AstNode | undefined)?.value === setting.key) {
			throw new ProjectError(`${file} already has the setting ${setting.key}`);
		}
	}

	const last = elements.at(-1);

	if (!last) {
		const indent = indentationAt(source, property.start);

		return `${source.slice(0, list.start)}[\n${indent}\t${settingSource(setting, `${indent}\t`)}\n${indent}]${source.slice(list.end)}`;
	}

	const indent = indentationAt(source, last.start);

	return `${source.slice(0, last.end)},\n${indent}${settingSource(setting, indent)}${source.slice(last.end)}`;
}

/** `add setting <key>`: appends the setting to `plugin.ts`, or the manifest in the legacy layout. */
async function addSetting(
	root: string,
	manifest: Manifest,
	key: string,
	options: AddOptions
): Promise<AddResult> {
	if (!SETTING_KEY_PATTERN.test(key)) {
		throw new ProjectError(INVALID_ID.setting(key));
	}

	const type = options.type ?? 'text';

	if (!(PLUGIN_SETTING_TYPES as readonly string[]).includes(type)) {
		throw new ProjectError(
			`Unknown setting type "${type}"`,
			[],
			`Use one of ${PLUGIN_SETTING_TYPES.join(', ')}, e.g. --type secret.`
		);
	}

	const setting: SettingTemplate = {
		key,
		label: title(key),
		type: type as PluginSettingType,
		...(type === 'boolean' ? { default: false } : {})
	};
	const read = `await ctx.settings.get('${key}')`;

	if (manifest.contributes !== undefined || manifest.server !== undefined) {
		const settings = (manifest.settings ??= []);

		if (!Array.isArray(settings)) {
			throw new ProjectError(`settings in ${MANIFEST_FILE} is not a list`);
		}

		if (settings.some((item: unknown) => (item as Record<string, unknown>)?.key === key)) {
			throw new ProjectError(`settings in ${MANIFEST_FILE} already has ${key}`);
		}

		settings.push({ key: setting.key, label: setting.label, type: setting.type });
		await writeFile(join(root, MANIFEST_FILE), json(manifest));

		return {
			created: [],
			hints: [`set the label and description of ${key} in ${MANIFEST_FILE}; read it with ${read}.`],
			manifestChanged: true,
			layout: 'legacy'
		};
	}

	if (manifest.settings !== undefined) {
		throw new ProjectError(
			`${MANIFEST_FILE} has "settings"; in the convention layout they belong in ${PLUGIN_FILE}`,
			[],
			`Move them to definePlugin({ settings }) in ${PLUGIN_FILE} and remove "settings" from ${MANIFEST_FILE}.`
		);
	}

	const hints = [
		`set the label${type === 'secret' ? ' and description' : ', description and default'} of ${key} in ${PLUGIN_FILE}; read it with ${read}.`
	];
	let existing: string | undefined;

	for (const file of PLUGIN_FILES) {
		if (await exists(join(root, file))) {
			existing = file;
			break;
		}
	}

	if (!existing) {
		await writeFile(join(root, PLUGIN_FILE), pluginFileSource([setting]));
		hints.push(
			`make sure "include" in tsconfig.json has ${PLUGIN_FILE}, so its Register block types ctx.settings.`
		);

		return { created: [PLUGIN_FILE], hints, manifestChanged: false, layout: 'convention' };
	}

	const source = await readFile(join(root, existing), 'utf8');

	await writeFile(join(root, existing), appendSetting(existing, source, setting));

	return {
		created: [],
		changed: [existing],
		hints,
		manifestChanged: false,
		layout: 'convention'
	};
}
