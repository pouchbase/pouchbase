<script module lang="ts">
	import type { Diagnostic, FilterNames } from './code-filter';

	/** `filter`: the filter syntax of API rules and `?filter=` (`#lib/filter/filter.ts`). */
	export type Language = 'javascript' | 'typescript' | 'json' | 'sql' | 'html' | 'filter';

	/** A suggestion of the editor's autocomplete, also shown when hovering it in the code. */
	export type Completion = {
		label: string;
		kind: 'function' | 'keyword' | 'value';
		/** Shown next to the label, e.g. the signature of a function. */
		detail?: string;
		/** Markdown. */
		documentation?: string;
		/** What is inserted, in snippet syntax (`$1`, `${1:default}`, `$0`); defaults to the label. */
		insertText?: string;
		/** Only suggested inside a string literal (`'…'`), e.g. the modifiers of a date function. */
		inString?: boolean;
	};

	export type Props = {
		value?: string;
		language?: Language;
		/**
		 * TypeScript declarations available to the code (JavaScript and TypeScript), for
		 * autocomplete, hovers and type errors, e.g. `declare const record: { title: string };`.
		 */
		typings?: string;
		/**
		 * Suggestions for languages without a language service of their own (such as SQL), with
		 * hovers for functions and keywords.
		 */
		completions?: Completion[];
		/** For `filter`: the fields autocomplete offers, after a space and after `$user.` and `$input.`. */
		filterNames?: FilterNames;
		/**
		 * Problems to underline, checked after every edit, e.g. from a parser; for languages
		 * without a language service of their own.
		 */
		diagnostics?: (value: string) => Diagnostic[];
		/** Show line numbers; turn off for short code such as a single expression. */
		lineNumbers?: boolean;
		/** Shown while the editor is empty. */
		placeholder?: string;
		/** Allow `return` outside a function, for code that runs as the body of a function. */
		allowReturn?: boolean;
		/** Standard library the code can use; leaves out the DOM by default. */
		lib?: string[];
		readonly?: boolean;
		/** Called after every edit made in the editor. */
		onValueChange?: (value: string) => void;
		id?: string;
		/** Size the editor with a height class; it fills the width. */
		class?: string;
		'aria-invalid'?: boolean | 'true' | 'false';
		'aria-describedby'?: string;
		'aria-labelledby'?: string;
		/** For an editor without a visible label. */
		'aria-label'?: string;
	};
</script>

<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type * as Monaco from 'monaco-editor';
	import { untrack } from 'svelte';
	import { theme } from '#lib/theme.svelte.js';
	import * as Spinner from '../../spinner';
	import {
		configureTypeScript,
		createWidgetsLayer,
		editorOptions,
		labelInput,
		modelUri,
		type EditorSettings
	} from './code-editor';
	import {
		FILTER_LANGUAGE,
		registerFilterCompletions,
		registerFilterLanguage,
		setDiagnostics
	} from './code-filter';
	import { loadMonaco, registerCompletions } from './code-monaco';
	import { defineThemes, themeName } from './code-theme';

	let {
		value = $bindable(''),
		language = 'javascript',
		typings,
		completions,
		filterNames,
		diagnostics,
		lineNumbers = true,
		placeholder,
		allowReturn = false,
		lib = ['es2022'],
		readonly = false,
		onValueChange,
		id: idProp,
		class: className,
		...aria
	}: Props = $props();

	const fallbackId = $props.id();
	const id = $derived(idProp ?? fallbackId);

	let editor = $state.raw<Monaco.editor.IStandaloneCodeEditor | null>(null);
	let failed = $state(false);
	// Set once the editor is created, so the diagnostics can be refreshed from an effect.
	let monacoApi = $state.raw<typeof Monaco | null>(null);

	const mount: Attachment<HTMLDivElement> = (node) => {
		let disposed = false;
		const disposables: Monaco.IDisposable[] = [];

		// Only the settings below are read here; content changes go through the effect further down.
		const settings: EditorSettings = untrack(() => ({
			language,
			typings,
			completions,
			lineNumbers,
			placeholder,
			allowReturn,
			lib,
			readonly,
			initial: value,
			key: id.replace(/[^\w-]/g, '')
		}));

		const widgets = createWidgetsLayer();

		loadMonaco()
			.then((monaco) => {
				if (disposed) {
					return;
				}

				disposables.push(...configureTypeScript(monaco, settings));

				if (settings.language === 'filter') {
					registerFilterLanguage(monaco);
				}

				const model = monaco.editor.createModel(
					settings.initial,
					settings.language === 'filter' ? FILTER_LANGUAGE : settings.language,
					modelUri(monaco, settings)
				);

				defineThemes(monaco);

				const instance = monaco.editor.create(node, {
					...editorOptions(settings, widgets),
					model,
					theme: untrack(() => themeName(theme.dark))
				});

				labelInput(node, aria);

				if (settings.completions?.length) {
					disposables.push(
						...registerCompletions(monaco, settings.language, model, settings.completions)
					);
				}

				if (settings.language === 'filter') {
					disposables.push(registerFilterCompletions(monaco, model, () => filterNames));
				}

				disposables.push(
					instance.onDidChangeModelContent(() => {
						value = model.getValue();
						onValueChange?.(value);
					}),
					instance,
					model
				);

				editor = instance;
				monacoApi = monaco;
			})
			.catch((error: unknown) => {
				console.error('Could not load the code editor', error);
				failed = true;
			});

		return () => {
			disposed = true;
			editor = null;

			for (const disposable of disposables.reverse()) {
				disposable.dispose();
			}

			widgets.remove();
		};
	};

	// Follows the dashboard when it switches between light and dark.
	$effect(() => {
		monacoApi?.editor.setTheme(themeName(theme.dark));
	});

	// Problems are underlined again after every edit, and when `diagnostics` changes.
	$effect(() => {
		const model = editor?.getModel();
		const problems = diagnostics?.(value) ?? [];

		if (monacoApi && model) {
			setDiagnostics(monacoApi, model, problems);
		}
	});

	// Changes from outside (e.g. a form reset) are written into the editor.
	$effect(() => {
		const next = value;

		if (editor && editor.getValue() !== next) {
			editor.setValue(next);
		}
	});
</script>

<div
	role="presentation"
	class={[
		'relative h-64 overflow-hidden rounded-md border border-zinc-300 bg-white shadow-xs',
		'focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10',
		aria['aria-invalid'] === true || aria['aria-invalid'] === 'true'
			? 'border-red-500 ring-red-500/10'
			: '',
		className
	]}
	onkeydown={(event) => {
		// Monaco uses Escape itself (closing suggestions, hovers, the find widget). It must never
		// also close a surrounding dialog and throw away the code; Monaco has already handled it.
		if (event.key === 'Escape') {
			event.stopPropagation();
		}
	}}
>
	<div {@attach mount} {id} class="size-full"></div>

	{#if !editor}
		<div
			class="absolute inset-0 flex items-center justify-center gap-2 bg-white text-sm text-zinc-500"
		>
			{#if failed}
				The code editor could not be loaded.
			{:else}
				<Spinner.Root />
				Loading editor…
			{/if}
		</div>
	{/if}
</div>
