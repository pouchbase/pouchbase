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
import { PLUGIN_FILES, routeFileFor, routePathFor } from './discover.js';
import { ProjectError } from './project-error.js';
import {
	EXAMPLE_PROVIDER_HOST,
	PLUGIN_FILE,
	camelCase,
	entrySource,
	fieldEntry,
	freeName,
	indented,
	json,
	pageEntry,
	pascalCase,
	pluginFileSource,
	providerEntry,
	routeEntry,
	settingSource,
	title,
	type Files,
	type PluginEntry,
	type SettingTemplate
} from './templates.js';

/**
 * `pouchbase-plugin add <kind> <id>`: creates the files of a contribution and adds it to
 * `definePlugin({ ... })` in `plugin.ts`, with the imports it needs; without `plugin.ts` it creates
 * one (with the `Register` block that types `ctx.settings`). The manifest only changes for an
 * explicit `categories` list or the example host of an auth provider. It never overwrites a file;
 * the manifest keeps its key order and is written tab-indented.
 *
 * `add setting <key>` appends a setting to `definePlugin({ settings })`.
 */

export const CONTRIBUTION_KINDS = ['field', 'page', 'auth-provider', 'route', 'setting'] as const;

export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export function isContributionKind(value: string): value is ContributionKind {
	return (CONTRIBUTION_KINDS as readonly string[]).includes(value);
}

export type AddOptions = {
	/** `add setting`: the setting's type; default `text`. */
	type?: string;
};

/** What an id of each kind with files of its own must match. */
const ID_SCHEMAS = {
	field: fieldContributionSchema.shape.type,
	page: pageContributionSchema.shape.path,
	'auth-provider': authProviderContributionSchema.shape.id
};

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

export type AddResult = {
	/** Files created, relative to the plugin. */
	created: string[];
	/** Existing files changed, other than the manifest (`plugin.ts` for `add setting`). */
	changed?: string[];
	/** What the author still has to do by hand, e.g. write a handler. */
	hints: string[];
	/** Whether `pouchbase-plugin.json` was written. */
	manifestChanged: boolean;
};

type Manifest = Record<string, unknown> & {
	settings?: unknown;
	categories?: unknown;
	permissions?: { network?: unknown };
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

export async function addContribution(
	root: string,
	kind: ContributionKind,
	id: string,
	options: AddOptions = {}
): Promise<AddResult> {
	const manifest = await readManifestJson(root);

	if (manifest.contributes !== undefined || manifest.server !== undefined) {
		throw new ProjectError(
			`${MANIFEST_FILE} has "contributes" or "server", which are generated from ${PLUGIN_FILE}`,
			[],
			`Move the contributions and server code into definePlugin({ ... }) in ${PLUGIN_FILE} and remove "contributes" and "server" from ${MANIFEST_FILE}.`
		);
	}

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

	return addToPlugin(root, manifest, kind, id);
}

/** `plugin.ts` (or `.js`) of the plugin in `root`, or `null` without one. */
async function findPluginFile(root: string): Promise<string | null> {
	for (const file of PLUGIN_FILES) {
		if (await exists(join(root, file))) {
			return file;
		}
	}

	return null;
}

/**
 * Creates the files of the contribution and adds it to `definePlugin({ ... })` in `plugin.ts`, with the imports it needs; creates `plugin.ts` without one.
 */
async function addToPlugin(
	root: string,
	manifest: Manifest,
	kind: Exclude<ContributionKind, 'setting'>,
	id: string
): Promise<AddResult> {
	const hints: string[] = [];
	let taken: string[] = [];
	let changed = false;

	if (kind !== 'route' && !ID_SCHEMAS[kind].safeParse(id).success) {
		throw new ProjectError(INVALID_ID[kind](id));
	}

	const file = await findPluginFile(root);
	const source = file ? await readFile(join(root, file), 'utf8') : '';
	// A name for an import of `plugin.ts` that it doesn't use yet.
	const used = (name: string) => new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(source);
	let entry: PluginEntry;

	switch (kind) {
		case 'field':
			entry = fieldEntry(id, freeName(camelCase(id), 'Field', used));
			taken = [`fields/${id}`];
			changed = addCategory(manifest, 'fields', hints);
			hints.push(
				`set the label, description and column in fields/${id}/field.ts; the column can't change once a collection uses the type.`
			);
			break;

		case 'page':
			entry = pageEntry(id, freeName(pascalCase(id), 'Page', used));
			changed = addCategory(manifest, 'pages', hints);
			break;

		case 'auth-provider':
			entry = providerEntry(id, freeName(camelCase(id), 'Provider', used));
			taken = [`auth/${id}`];
			changed = addCategory(manifest, 'auth', hints);
			changed = addExampleHost(manifest) || changed;
			hints.push(
				`replace the example URLs in auth/${id}/provider.ts and ${EXAMPLE_PROVIDER_HOST} in permissions.network with your provider's, and auth/${id}/icon.svg with its logo.`
			);
			break;

		case 'route': {
			const routeFile = routeFileFor(id);
			const path = routePathFor(id);

			if (!routeFile) {
				throw new ProjectError(INVALID_ID.route(id));
			}

			entry = routeEntry(
				path,
				routeFile,
				freeName(camelCase(path) || 'root', 'Route', used),
				typeof manifest.id === 'string' ? manifest.id : null
			);
			hints.push(`export POST, PUT, PATCH or DELETE from ${routeFile} to answer other methods.`);
			break;
		}
	}

	// Checked before any file is written, so a failure leaves the plugin as it was.
	const updated = file ? addToDefinition(file, source, entry) : null;

	await writeNewFiles(root, entry.files, taken);

	if (file && updated !== null) {
		await writeFile(join(root, file), updated);
	} else {
		await writeFile(join(root, PLUGIN_FILE), pluginFileSource([], [entry]));
	}

	if (changed) {
		await writeFile(join(root, MANIFEST_FILE), json(manifest));
	}

	return {
		created: [...Object.keys(entry.files), ...(file ? [] : [PLUGIN_FILE])],
		changed: file ? [file] : [],
		hints,
		manifestChanged: changed
	};
}

/**
 * `source` (a `plugin.ts`) with `entry` added to its record in `definePlugin({ ... })` (which it
 * creates when the definition has none) and its imports after the last import; a `ProjectError`
 * when it can't find that call, or the id is taken.
 */
export function addToDefinition(
	file: string,
	source: string,
	entry: Pick<PluginEntry, 'key' | 'id' | 'value' | 'imports'>
): string {
	const { definition, program } = findDefinition(file, source);
	const snippet = `${entry.key}: { ${entrySource(entry).replace(/\s*\n\s*/g, ' ')} }`;
	const hint = `Add it to definePlugin({ ... }) in ${file} by hand: ${entry.imports.join(' ')} ${snippet}`;

	if (!definition) {
		throw new ProjectError(`${file} has no definePlugin({ ... }) call`, [], hint);
	}

	const property = (definition.properties as AstNode[]).find(
		(node) => propertyName(node) === entry.key
	);
	let result: string;

	if (!property) {
		// The record becomes the last property of the definition.
		const indent = `${indentationAt(source, definition.start)}\t`;
		const record = `${entry.key}: {\n${indent}\t${indented(entrySource(entry), `${indent}\t`)}\n${indent}}`;
		const last = (definition.properties as AstNode[]).at(-1);

		result = last
			? `${source.slice(0, last.end)},\n${indent}${record}${source.slice(last.end)}`
			: `${source.slice(0, definition.start)}{\n${indent}${record}\n${indentationAt(source, definition.start)}}${source.slice(definition.end)}`;
	} else {
		const record = property.value as AstNode;

		if (record.type !== 'ObjectExpression') {
			throw new ProjectError(`${entry.key} in ${file} is not an object literal`, [], hint);
		}

		const properties = record.properties as AstNode[];

		if (properties.some((node) => propertyName(node) === entry.id)) {
			throw new ProjectError(`${entry.key} in ${file} already has ${entry.id}`);
		}

		const last = properties.at(-1);

		if (last) {
			const indent = indentationAt(source, last.start);

			result = `${source.slice(0, last.end)},\n${indent}${indented(entrySource(entry), indent)}${source.slice(last.end)}`;
		} else {
			const indent = indentationAt(source, property.start);

			result = `${source.slice(0, record.start)}{\n${indent}\t${indented(entrySource(entry), `${indent}\t`)}\n${indent}}${source.slice(record.end)}`;
		}
	}

	// The imports come before the definition, so its offsets still hold.
	const imports = (program.body as AstNode[]).filter((node) => node.type === 'ImportDeclaration');
	const last = imports.at(-1);
	const lines = entry.imports.join('\n');

	if (!last) {
		return `${lines}\n\n${result}`;
	}

	// A blank line between packages and the plugin's own files, as the templates have it.
	const ownFiles = String((last.source as AstNode | undefined)?.value ?? '').startsWith('.');

	return `${result.slice(0, last.end)}${ownFiles ? '\n' : '\n\n'}${lines}${result.slice(last.end)}`;
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
 * The parsed `source` (a `plugin.ts`) and the object literal of its `definePlugin({ ... })` call,
 * when it has one.
 */
function findDefinition(
	file: string,
	source: string
): { program: AstNode; definition: AstNode | undefined } {
	let program: AstNode;

	try {
		program = parseAst(source, { lang: file.endsWith('.ts') ? 'ts' : 'js' }, file) as never;
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

	return {
		program,
		definition: definition?.type === 'ObjectExpression' ? definition : undefined
	};
}

/**
 * `source` (a `plugin.ts`) with `setting` appended to the settings of its `definePlugin({ ... })`
 * call; a `ProjectError` when it can't find that call, or the key is taken.
 */
export function appendSetting(file: string, source: string, setting: SettingTemplate): string {
	const { definition } = findDefinition(file, source);
	const hint = `Add it to definePlugin({ settings: [...] }) in ${file} by hand: ${settingSource(setting, '').replace(/\s*\n\s*/g, ' ')}`;

	if (!definition) {
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

/** `add setting <key>`: appends the setting to `plugin.ts`. */
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

	if (manifest.settings !== undefined) {
		throw new ProjectError(
			`${MANIFEST_FILE} has "settings"; they belong in ${PLUGIN_FILE}`,
			[],
			`Move them to definePlugin({ settings }) in ${PLUGIN_FILE} and remove "settings" from ${MANIFEST_FILE}.`
		);
	}

	const hints = [
		`set the label${type === 'secret' ? ' and description' : ', description and default'} of ${key} in ${PLUGIN_FILE}; read it with ${read}.`
	];
	const existing = await findPluginFile(root);

	if (!existing) {
		await writeFile(join(root, PLUGIN_FILE), pluginFileSource([setting]));
		hints.push(
			`make sure "include" in tsconfig.json has ${PLUGIN_FILE}, so its Register block types ctx.settings.`
		);

		return { created: [PLUGIN_FILE], hints, manifestChanged: false };
	}

	const source = await readFile(join(root, existing), 'utf8');

	await writeFile(join(root, existing), appendSetting(existing, source, setting));

	return {
		created: [],
		changed: [existing],
		hints,
		manifestChanged: false
	};
}
