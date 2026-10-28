import type * as MonacoApi from 'monaco-editor';

import { FILTER_RULES } from './code-filter';

type Monaco = typeof MonacoApi;

// Monaco has one theme for all editors on the page.
const LIGHT_THEME = 'pouchbase';
const DARK_THEME = 'pouchbase-dark';

/** The name of the theme for the dashboard's light or dark mode. */
export function themeName(dark: boolean) {
	return dark ? DARK_THEME : LIGHT_THEME;
}

/**
 * Defines the light and dark themes, with scrollbars in the colors of `ScrollArea` (zinc
 * 300/400/500); the dark one on the background of the dashboard's dark surfaces.
 */
export function defineThemes(monaco: Monaco) {
	monaco.editor.defineTheme(LIGHT_THEME, {
		base: 'vs',
		inherit: true,
		rules: [
			{ token: 'variable', foreground: '7c3aed' },
			{ token: 'predefined', foreground: '0369a1' },
			...FILTER_RULES.light
		],
		colors: {
			'scrollbar.shadow': '#00000000',
			'scrollbarSlider.background': '#d4d4d8',
			'scrollbarSlider.hoverBackground': '#a1a1aa',
			'scrollbarSlider.activeBackground': '#71717a'
		}
	});
	monaco.editor.defineTheme(DARK_THEME, {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'variable', foreground: 'a78bfa' },
			{ token: 'predefined', foreground: '38bdf8' },
			...FILTER_RULES.dark
		],
		colors: {
			'editor.background': '#111114',
			'editorGutter.background': '#111114',
			'editor.lineHighlightBackground': '#1e1e21',
			'editor.lineHighlightBorder': '#00000000',
			'scrollbar.shadow': '#00000000',
			'scrollbarSlider.background': '#3f3f45',
			'scrollbarSlider.hoverBackground': '#686871',
			'scrollbarSlider.activeBackground': '#8b8b95'
		}
	});
}
