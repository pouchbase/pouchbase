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
 * Every module a UI file may import besides the plugin's own files, by its exact specifier:
 * `svelte` (Svelte's compiler output imports `svelte/internal/*`), the prop types from
 * `@pouchbasejs/plugin-sdk/ui`, and the dashboard's components from `@pouchbasejs/ui`, one entry
 * per component (`@pouchbasejs/ui/button`, `@pouchbasejs/ui/inputs/select`). The host provides
 * them at runtime, in the versions the dashboard itself uses, so a plugin never bundles its own
 * copy; install them as devDependencies for type checking only.
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

/** Calls the plugin's own `routes` with the admin's session. */
export type PluginApi = {
	fetch(path: `/${string}`, init?: RequestInit): Promise<Response>;
};

/** Props of a page, in `pages` of `definePlugin`. */
export type PageProps = {
	/** Path below the page, e.g. `['2026', '10']` for `/plugins/<plugin>/reports/2026/10`. */
	params: string[];
	api: PluginApi;
};
