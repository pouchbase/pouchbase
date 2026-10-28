import type * as MonacoApi from 'monaco-editor';

import type { Completion, Language } from './code-root.svelte';

type Monaco = typeof MonacoApi;

/** The settings an editor is created with; later changes to them are not applied. */
export interface EditorSettings {
	language: Language;
	typings?: string;
	completions?: Completion[];
	lineNumbers: boolean;
	placeholder?: string;
	allowReturn: boolean;
	lib: string[];
	readonly: boolean;
	initial: string;
	/** Unique per editor, for the model and typings URIs. */
	key: string;
}

const EXTENSIONS: Record<Language, string> = {
	javascript: 'js',
	typescript: 'ts',
	json: 'json',
	sql: 'sql',
	html: 'html',
	filter: 'filter'
};

/** The URI of an editor's model, with an extension matching its language. */
export function modelUri(monaco: Monaco, settings: EditorSettings) {
	return monaco.Uri.parse(`file:///${settings.key}.${EXTENSIONS[settings.language]}`);
}

/** Configures the TypeScript service for JavaScript and TypeScript; returns what to dispose. */
export function configureTypeScript(monaco: Monaco, settings: EditorSettings) {
	const disposables: MonacoApi.IDisposable[] = [];

	if (settings.language !== 'javascript' && settings.language !== 'typescript') {
		return disposables;
	}

	const defaults =
		settings.language === 'javascript'
			? monaco.typescript.javascriptDefaults
			: monaco.typescript.typescriptDefaults;

	defaults.setCompilerOptions({
		target: monaco.typescript.ScriptTarget.ES2020,
		lib: settings.lib,
		allowJs: true,
		checkJs: true,
		allowNonTsExtensions: true
	});
	defaults.setDiagnosticsOptions({
		noSemanticValidation: false,
		noSyntaxValidation: false,
		// 1108: "A 'return' statement can only be used within a function body".
		diagnosticCodesToIgnore: settings.allowReturn ? [1108] : []
	});

	if (settings.typings) {
		disposables.push(
			defaults.addExtraLib(settings.typings, `file:///${settings.key}-typings.d.ts`)
		);
	}

	return disposables;
}

/** The options of `monaco.editor.create`, apart from the model and theme. */
export function editorOptions(
	settings: EditorSettings,
	widgets: HTMLElement
): MonacoApi.editor.IStandaloneEditorConstructionOptions {
	return {
		readOnly: settings.readonly,
		automaticLayout: true,
		minimap: { enabled: false },
		scrollBeyondLastLine: false,
		fontSize: 12,
		lineHeight: 18,
		fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
		tabSize: 2,
		insertSpaces: false,
		lineNumbersMinChars: 3,
		overviewRulerLanes: 0,
		padding: { top: 8, bottom: 8 },
		renderLineHighlight: 'line',
		wordBasedSuggestions: 'off',
		quickSuggestions: {
			other: true,
			comments: false,
			strings: !!settings.completions?.some((completion) => completion.inString)
		},
		lineNumbers: settings.lineNumbers ? 'on' : 'off',
		placeholder: settings.placeholder,
		folding: settings.lineNumbers,
		glyphMargin: false,
		lineDecorationsWidth: settings.lineNumbers ? 10 : 8,
		overflowWidgetsDomNode: widgets,
		fixedOverflowWidgets: true,
		scrollbar: {
			useShadows: false,
			verticalScrollbarSize: 10,
			horizontalScrollbarSize: 10,
			verticalSliderSize: 6,
			horizontalSliderSize: 6
		}
	};
}

/**
 * Creates the layer for suggestions, hovers and parameter hints, directly under `body`, so they
 * can extend past a surrounding dialog (whose `translate` and `contain` would otherwise position
 * and clip them). `monaco-editor` makes Monaco's styles apply. Remove it when the editor goes.
 */
export function createWidgetsLayer() {
	const widgets = document.createElement('div');
	widgets.className = 'monaco-editor';
	// Above dialogs (z-50). A modal dialog turns off pointer events on `body` (only its own
	// overlay and content opt back in), so this layer opts back in too.
	widgets.style.cssText = 'position: relative; z-index: 60; pointer-events: auto;';
	// Monaco has handled the pointer by the time it bubbles up to here. Stopping it keeps a
	// surrounding dialog from treating a click on a suggestion as a click outside and closing.
	widgets.addEventListener('pointerdown', (event) => event.stopPropagation());
	document.body.appendChild(widgets);

	return widgets;
}

/** Copies the ARIA attributes onto the control that actually receives focus (its textarea). */
export function labelInput(node: HTMLElement, aria: Record<string, unknown>) {
	const input = node.querySelector('textarea');

	for (const [name, attribute] of Object.entries(aria)) {
		if (attribute !== undefined) {
			input?.setAttribute(name, String(attribute));
		}
	}
}
