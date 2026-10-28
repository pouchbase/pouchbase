import { parseAst } from 'rolldown/parseAst';

import { ProjectError } from './project-error.js';
import {
	entrySource,
	indented,
	settingSource,
	type PluginEntry,
	type SettingTemplate
} from './templates/index.js';

/**
 * Editing the source of `plugin.ts` for `add`: an entry in a record of `definePlugin({ ... })`, or
 * a setting in its `settings`. The source is parsed, and only the new text is inserted, so the
 * rest keeps its formatting.
 */

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
