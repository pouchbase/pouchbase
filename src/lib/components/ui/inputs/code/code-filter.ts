import type { FilterFunctionArgument } from '#lib/filter/functions.js';
import type * as MonacoApi from 'monaco-editor';

import { FILTER_FUNCTIONS, functionSignature } from '#lib/filter/functions.js';

type Monaco = typeof MonacoApi;

/**
 * A field that a condition can use, for autocomplete. A relation also has the collection it points
 * to (`target`), so `author.` suggests that collection's fields.
 */
export type FilterName = { name: string; type: string; target?: string; multiple?: boolean };

/**
 * What the autocomplete of a condition offers: the collection's fields, those of `users`, and the
 * fields of every collection by name, for paths through relations (`author.role`).
 */
export type FilterNames = {
	fields: FilterName[];
	userFields: FilterName[];
	collections?: Record<string, FilterName[]>;
};

/** The relation at the end of a path of field names (`['post', 'author']`), or `null`. */
export function filterRelation(
	names: FilterNames,
	path: string[]
): { collection: string; fields: FilterName[]; multiple: boolean } | null {
	let fields = names.fields;
	let found: { collection: string; fields: FilterName[]; multiple: boolean } | null = null;

	for (const part of path) {
		const field = fields.find((candidate) => candidate.name === part);
		const target = field?.type === 'relation' && field.target;

		if (!target || !names.collections?.[target]) {
			return null;
		}

		fields = names.collections[target];
		found = { collection: target, fields, multiple: !!field.multiple };
	}

	return found;
}

/** A problem to underline in the code, with offsets in the text (`end` exclusive). */
export type Diagnostic = { message: string; start: number; end: number };

/** Monaco id of the condition language of API rules and `?where=` (see `#lib/filter/filter.ts`). */
export const FILTER_LANGUAGE = 'pouchbase-filter';

type ThemeRule = MonacoApi.editor.ITokenThemeRule;

/**
 * Colors of the condition language's tokens, for the light and dark editor themes: `AND`/`&&`
 * stand out from the comparisons, fields from `$user`, and lowercase `and` is marked as wrong.
 */
export const FILTER_RULES: { light: ThemeRule[]; dark: ThemeRule[] } = {
	light: [
		{ token: 'filter-logical', foreground: 'db2777', fontStyle: 'bold' },
		{ token: 'filter-compare', foreground: '52525b' },
		{ token: 'filter-field', foreground: '1d4ed8' },
		{ token: 'filter-variable', foreground: '7c3aed', fontStyle: 'bold' },
		{ token: 'filter-member', foreground: '7c3aed' },
		{ token: 'filter-function', foreground: 'a16207' },
		{ token: 'filter-string', foreground: '15803d' },
		{ token: 'filter-number', foreground: 'c2410c' },
		{ token: 'filter-constant', foreground: '0f766e', fontStyle: 'bold' },
		{ token: 'filter-delimiter', foreground: '71717a' },
		{ token: `delimiter.parenthesis.${FILTER_LANGUAGE}`, foreground: '71717a' },
		{ token: 'filter-comment', foreground: 'a1a1aa', fontStyle: 'italic' },
		{ token: 'filter-invalid', foreground: 'dc2626', fontStyle: 'underline' }
	],
	dark: [
		{ token: 'filter-logical', foreground: 'f472b6', fontStyle: 'bold' },
		{ token: 'filter-compare', foreground: 'd4d4d8' },
		{ token: 'filter-field', foreground: '93c5fd' },
		{ token: 'filter-variable', foreground: 'c4b5fd', fontStyle: 'bold' },
		{ token: 'filter-member', foreground: 'c4b5fd' },
		{ token: 'filter-function', foreground: 'fcd34d' },
		{ token: 'filter-string', foreground: '86efac' },
		{ token: 'filter-number', foreground: 'fdba74' },
		{ token: 'filter-constant', foreground: '5eead4', fontStyle: 'bold' },
		{ token: 'filter-delimiter', foreground: 'a1a1aa' },
		{ token: `delimiter.parenthesis.${FILTER_LANGUAGE}`, foreground: 'a1a1aa' },
		{ token: 'filter-comment', foreground: '71717a', fontStyle: 'italic' },
		{ token: 'filter-invalid', foreground: 'f87171', fontStyle: 'underline' }
	]
};

let registered = false;

/** Registers the condition language (highlighting, brackets, comments) once. */
export function registerFilterLanguage(monaco: Monaco) {
	if (registered) {
		return;
	}

	monaco.languages.register({ id: FILTER_LANGUAGE });
	monaco.languages.setLanguageConfiguration(FILTER_LANGUAGE, {
		comments: { lineComment: '#' },
		brackets: [['(', ')']],
		autoClosingPairs: [
			{ open: '(', close: ')' },
			{ open: '"', close: '"', notIn: ['string'] },
			{ open: "'", close: "'", notIn: ['string'] }
		],
		wordPattern: /\$?[\w.]+/
	});
	// Token names start with `filter-`, so the theme's colors for them (`code-root.svelte`) don't
	// change other languages.
	monaco.languages.setMonarchTokensProvider(FILTER_LANGUAGE, {
		tokenizer: {
			root: [
				[/#.*$/, 'filter-comment'],
				// `$user` and `$input`, and the field after them.
				[/(\$\w*)((?:\.\w*)*)/, ['filter-variable', 'filter-member']],
				[/\b(AND|OR|NOT)\b/, 'filter-logical'],
				[/&&|\|\||!(?!=)/, 'filter-logical'],
				[/\b(true|false|null)\b/, 'filter-constant'],
				[/-?\d+(\.\d+)?\b/, 'filter-number'],
				[/"([^"\\]|\\.)*"?/, 'filter-string'],
				[/'([^'\\]|\\.)*'?/, 'filter-string'],
				// `contains(`, `now(` and `any(`; a name without `(` is a field.
				[/[a-z]\w*(?=\s*\()/, 'filter-function'],
				[/==|!=|>=|<=|>|</, 'filter-compare'],
				[/[()]/, '@brackets'],
				[/,/, 'filter-delimiter'],
				// Lowercase `and`, `or` and `not` are mistakes; the diagnostics say what to write.
				[/\b(and|or|not)\b/, 'filter-invalid'],
				// A field, or a path through relations (`post.author.role`).
				[/[a-z]\w*(\.\w*)*/, 'filter-field'],
				[/\s+/, 'white'],
				[/[A-Za-z_]\w*|./, 'filter-invalid']
			]
		}
	});
	registered = true;
}

/**
 * Autocomplete for one condition editor: fields after a space or comparison, the user's fields
 * after `$user.`, the collection's after `$input.`. `names` is read on every request, so it can
 * change while the editor is open.
 */
export function registerFilterCompletions(
	monaco: Monaco,
	model: MonacoApi.editor.ITextModel,
	names: () => FilterNames | undefined
): MonacoApi.IDisposable {
	const { CompletionItemKind } = monaco.languages;

	return monaco.languages.registerCompletionItemProvider(FILTER_LANGUAGE, {
		triggerCharacters: ['$', '.'],
		provideCompletionItems(target, position) {
			if (target !== model) {
				return { suggestions: [] };
			}

			const line = target.getLineContent(position.lineNumber).slice(0, position.column - 1);
			const prefix = /[$\w.]*$/.exec(line)?.[0] ?? '';
			const range = {
				startLineNumber: position.lineNumber,
				startColumn: position.column - prefix.length,
				endLineNumber: position.lineNumber,
				endColumn: position.column
			};
			const current = names();
			const { fields = [], userFields = [] } = current ?? {};
			// Picking `$user.` suggests what follows, like in a code editor.
			const retrigger = { id: 'editor.action.triggerSuggest', title: 'Suggest' };
			const field = (name: FilterName, insert: string, detail: string) => ({
				label: insert,
				kind: CompletionItemKind.Field,
				detail: `${name.type} · ${detail}`,
				insertText: insert,
				range
			});

			if (prefix.startsWith('$user.')) {
				return {
					// Asked again as you type, so `$user.` lists the user's fields.
					incomplete: true,
					suggestions: userFields.map((name) =>
						field(name, `$user.${name.name}`, 'the signed-in user')
					)
				};
			}

			if (prefix.startsWith('$input.')) {
				return {
					// Asked again as you type, so `$input.` lists the collection's fields.
					incomplete: true,
					suggestions: fields.map((name) =>
						field(name, `$input.${name.name}`, 'the submitted value')
					)
				};
			}

			const variables = [
				{
					label: '$user.',
					detail: 'A field of the signed-in user; empty when signed out',
					command: retrigger
				},
				{
					label: '$input.',
					detail: 'A submitted value, for create and update rules',
					command: retrigger
				}
			].map((variable) => ({
				...variable,
				kind: CompletionItemKind.Variable,
				insertText: variable.label,
				range
			}));

			if (prefix.startsWith('$')) {
				return { incomplete: true, suggestions: variables };
			}

			// `post.author.`: the fields of the record the relation points to.
			if (prefix.includes('.') && current) {
				const path = prefix.split('.').slice(0, -1);
				const relation = filterRelation(current, path);

				return {
					incomplete: true,
					suggestions: (relation?.fields ?? []).map((name) =>
						field(name, `${path.join('.')}.${name.name}`, `field of ${relation!.collection}`)
					)
				};
			}

			const functions = [
				...Object.entries(FILTER_FUNCTIONS).map(([name, fn]) => ({
					label: name,
					detail: functionSignature(name as keyof typeof FILTER_FUNCTIONS),
					documentation: `${fn.description}\n\n${fn.example}`,
					insertText: functionSnippet(name, fn.args)
				})),
				{
					label: 'any',
					detail: 'any(field)',
					documentation:
						'Each item of a multiple relation or list: true when the condition holds for any.\n\nany(editors) == $user.id',
					insertText: 'any(${1:field})'
				}
			].map((fn) => ({
				...fn,
				kind: CompletionItemKind.Function,
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				range
			}));

			return {
				incomplete: true,
				suggestions: [
					...fields.map((name) => field(name, name.name, 'field of this collection')),
					...variables,
					...functions,
					...[
						{ label: 'AND', detail: 'Both conditions hold; also &&' },
						{ label: 'OR', detail: 'Either condition holds; also ||' },
						{ label: 'NOT', detail: 'The condition does not hold; also !' },
						{ label: 'true' },
						{ label: 'false' },
						{ label: 'null', detail: 'Empty; also matches ""' }
					].map((keyword) => ({
						...keyword,
						kind: CompletionItemKind.Keyword,
						insertText: keyword.label,
						range
					}))
				]
			};
		}
	});
}

/** What autocomplete inserts for a function: `date_add(${1:date}, ${2:amount}, "${3:days}")`. */
function functionSnippet(name: string, args: readonly FilterFunctionArgument[]) {
	const placeholders = args
		.filter((arg) => !arg.optional)
		.map((arg, index) =>
			arg.units ? `"\${${index + 1}:${arg.units[0]}}"` : `\${${index + 1}:${arg.name}}`
		);

	return `${name}(${placeholders.join(', ')})`;
}

/** Underlines `diagnostics` in the model; an empty list clears them. */
export function setDiagnostics(
	monaco: Monaco,
	model: MonacoApi.editor.ITextModel,
	diagnostics: Diagnostic[]
) {
	monaco.editor.setModelMarkers(
		model,
		'pouchbase',
		diagnostics.map((diagnostic) => {
			const start = model.getPositionAt(diagnostic.start);
			const end = model.getPositionAt(Math.max(diagnostic.end, diagnostic.start + 1));

			return {
				severity: monaco.MarkerSeverity.Error,
				message: diagnostic.message,
				startLineNumber: start.lineNumber,
				startColumn: start.column,
				endLineNumber: end.lineNumber,
				endColumn: end.column
			};
		})
	);
}
