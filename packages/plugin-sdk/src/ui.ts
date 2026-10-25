/**
 * Props of the Svelte components a plugin contributes. The host compiles these components on
 * install and renders them in the dashboard (client-side only).
 *
 * ```svelte
 * <script lang="ts">
 * 	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';
 *
 * 	let { name, value, required, disabled }: FieldInputProps<string> = $props();
 * </script>
 *
 * <input type="color" {name} value={value ?? '#000000'} {required} {disabled} />
 * ```
 *
 * A UI file may import exactly the `HOST_MODULE_IDS` and other UI files of the plugin (components
 * and shared modules such as `lib/`, by relative path; not its server code), with static imports
 * only, nothing else.
 */

/**
 * The packages whose modules a UI file may import besides the plugin's own UI files: `svelte`, the
 * prop types from `@pouchbasejs/plugin-sdk/ui`, and the dashboard's components from
 * `@pouchbasejs/ui` (`import * as Button from '@pouchbasejs/ui/button'`). The host provides them at
 * runtime, in the versions the dashboard itself uses, so a plugin never bundles its own copy;
 * install them as devDependencies for type checking only. A `/*` entry stands for subpaths.
 *
 * @deprecated A pattern, looser than what the host links: only the exact `HOST_MODULE_IDS` can be
 * imported (`svelte/store` but not `svelte/compiler`, `@pouchbasejs/ui/button` but not a component
 * the dashboard doesn't have). Use `HOST_MODULE_IDS` and `isHostModuleId`.
 */
export const HOST_MODULES = [
	'svelte',
	'svelte/*',
	'@pouchbasejs/plugin-sdk/ui',
	'@pouchbasejs/ui',
	'@pouchbasejs/ui/*'
] as const;

/**
 * Every module the host provides at runtime, by its exact specifier: what `HOST_MODULES` allows
 * and the compiled components actually import. Svelte's compiler output imports
 * `svelte/internal/*`; `@pouchbasejs/ui` has one entry per component (`@pouchbasejs/ui/button`,
 * `@pouchbasejs/ui/inputs/select`).
 */
export const HOST_MODULE_IDS = [
	'svelte',
	'svelte/internal/client',
	'svelte/internal/disclose-version',
	'svelte/internal/flags/legacy',
	'svelte/store',
	'svelte/transition',
	'svelte/animate',
	'svelte/easing',
	'svelte/motion',
	'svelte/reactivity',
	'svelte/events',
	'svelte/attachments',
	'@pouchbasejs/plugin-sdk/ui',
	'@pouchbasejs/ui',
	'@pouchbasejs/ui/badge',
	'@pouchbasejs/ui/button',
	'@pouchbasejs/ui/callout',
	'@pouchbasejs/ui/card',
	'@pouchbasejs/ui/empty',
	'@pouchbasejs/ui/icon',
	'@pouchbasejs/ui/link',
	'@pouchbasejs/ui/meter',
	'@pouchbasejs/ui/progress',
	'@pouchbasejs/ui/scroll-area',
	'@pouchbasejs/ui/segmented',
	'@pouchbasejs/ui/skeleton',
	'@pouchbasejs/ui/spinner',
	'@pouchbasejs/ui/swatch',
	'@pouchbasejs/ui/table',
	'@pouchbasejs/ui/thumbnail',
	'@pouchbasejs/ui/tile',
	'@pouchbasejs/ui/tooltip',
	'@pouchbasejs/ui/inputs/checkbox',
	'@pouchbasejs/ui/inputs/input',
	'@pouchbasejs/ui/inputs/select',
	'@pouchbasejs/ui/inputs/slider',
	'@pouchbasejs/ui/inputs/textarea'
] as const;

export type HostModuleId = (typeof HOST_MODULE_IDS)[number];

/** Whether a UI file may import `specifier`, which is not a relative path: one of `HOST_MODULE_IDS`. */
export function isHostModuleId(specifier: string): specifier is HostModuleId {
	return (HOST_MODULE_IDS as readonly string[]).includes(specifier);
}

/**
 * Whether `specifier` matches `HOST_MODULES`.
 *
 * @deprecated Looser than what the host links; use `isHostModuleId`.
 */
export function isHostModule(specifier: string): boolean {
	return HOST_MODULES.some((module) =>
		module.endsWith('/*')
			? specifier.startsWith(module.slice(0, -1)) && specifier.length > module.length - 1
			: specifier === module
	);
}

/** The field a component is rendered for. */
export type FieldInfo = {
	/** Column name. */
	name: string;
	/** `<plugin>:<type>`. */
	type: string;
	required: boolean;
	options: Record<string, unknown>;
};

export type FieldInputProps<T = unknown> = {
	field: FieldInfo;
	/**
	 * Name to give the form control that holds the value; it is submitted with the record form.
	 * Use a hidden `<input>` when the value is edited by something else.
	 */
	name: string;
	/** Current value; `null` for an empty or new record. */
	value: T | null;
	required: boolean;
	disabled: boolean;
	/** Id for the control, so the field label points at it. */
	id: string;
	/** Validation message from the last submit, to link with `aria-describedby`. */
	errorId?: string;
};

/** Props of a field type's preview, which shows the value, read-only, in the records grid. */
export type FieldPreviewProps<T = unknown> = {
	field: FieldInfo;
	value: T | null;
};

/** @deprecated The former name of `FieldPreviewProps`. */
export type FieldCellProps<T = unknown> = FieldPreviewProps<T>;

/** Calls the plugin's own `routes` with the admin's session. */
export type PluginApi = {
	fetch(path: `/${string}`, init?: RequestInit): Promise<Response>;
};

/**
 * What a page component says about itself, in its `<script module>`:
 * `export const page = { title: 'Stats' } satisfies PageMeta` (with `import type { PageMeta } from
 * '@pouchbasejs/plugin-sdk/ui'`), or `export const page = definePage({ title: 'Stats' })`. The CLI
 * reads it without running the component, so it must be a literal: no other imports, variables
 * or function calls.
 */
export type PageMeta = {
	/** Title in the dashboard; missing uses the file name. */
	title?: string;
	/** Whether the page gets a link in the sidebar; default `true`. */
	navigation?: boolean;
	/**
	 * Where the page comes among the plugin's pages, in the sidebar too: lower first. Pages without
	 * one follow, by path.
	 */
	order?: number;
	/**
	 * The page's icon in the sidebar, drawn in one color like the dashboard's own links: an Iconify
	 * name such as `lucide:chart-bar`, which the CLI turns into an SVG in the bundle, or the path of
	 * an `.svg` file relative to the page. Missing uses the `.svg` file with the page's name next to
	 * it (`stats.svg` for `stats.svelte`), else a puzzle piece.
	 */
	icon?: string;
};

/**
 * Types a page's metadata and returns it unchanged: in a page's `<script module>`,
 * `import { definePage } from '@pouchbasejs/plugin-sdk/ui'` and
 * `export const page = definePage({ title: 'Stats' })`. The argument must be a literal, which the
 * CLI reads without running the component.
 */
export function definePage<T extends PageMeta>(meta: T): T {
	return meta;
}

export type PageProps = {
	/** Path below the page, e.g. `['2026', '10']` for `/plugins/<plugin>/reports/2026/10`. */
	params: string[];
	api: PluginApi;
};
