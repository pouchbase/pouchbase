import { resolve } from '$app/paths';

/**
 * The components of `@pouchbasejs/ui` (`packages/ui`), documented under `/docs/ui`. Text may use
 * `backticks` for inline code and [links](/docs/ui/<slug>#<hash>) to these docs. Each example is a component in
 * `src/routes/docs/plugins/ui/[component=slug]/examples/<slug>/<example>.svelte`, shown as a live preview and as
 * its source; its page is described by `examples/<slug>/meta.ts` next to them.
 */

export interface UiProp {
	name: string;
	type: string;
	default?: string;
	description: string;
}

export interface UiPart {
	/** The export name, e.g. `Root` for `Card.Root`. */
	name: string;
	description: string;
	/**
	 * The element whose attributes the part takes (and passes on), e.g. `<div>`; it also takes
	 * `class`. Left out for parts with only the props listed.
	 */
	element?: string;
	props?: UiProp[];
}

export interface UiExample {
	/** The file name in `examples/<slug>/`, without `.svelte`. */
	id: string;
	title: string;
	description?: string;
}

export type UiCategory = 'forms' | 'feedback' | 'display';

/** The categories the components are grouped by, in the docs sidebar and on the overview. */
export const uiCategories: { id: UiCategory; title: string }[] = [
	{ id: 'forms', title: 'Forms and inputs' },
	{ id: 'feedback', title: 'Feedback and status' },
	{ id: 'display', title: 'Data display' }
];

export interface UiComponent {
	/** The URL segment, e.g. `input` for `/docs/ui/input`. */
	slug: string;
	category: UiCategory;
	/** The namespace it is imported as, e.g. `ScrollArea`. */
	name: string;
	title: string;
	/** The entry point below `@pouchbasejs/ui/`, e.g. `inputs/input`. */
	entry: string;
	/** One sentence, for the page's description and the overview. */
	description: string;
	/** Paragraphs of the page, before the examples. */
	about?: string[];
	parts: UiPart[];
	examples: UiExample[];
}

// Every component's `meta.ts`, next to its examples, sorted by slug.
const metas = import.meta.glob<UiComponent>(
	'../routes/docs/plugins/ui/\\[component=slug\\]/examples/*/meta.ts',
	{ import: 'default', eager: true }
);

export const uiComponents: UiComponent[] = Object.values(metas).sort((a, b) =>
	a.slug < b.slug ? -1 : 1
);

/** The docs page of an import specifier, e.g. `@pouchbasejs/ui/inputs/input`, if it is one of the package. */
export function uiComponentHref(specifier: string) {
	if (specifier === '@pouchbasejs/ui') {
		return resolve('/docs/plugins/ui');
	}

	const component = uiComponents.find((item) => `@pouchbasejs/ui/${item.entry}` === specifier);

	return component
		? resolve('/docs/plugins/ui/[component=slug]', { component: component.slug })
		: undefined;
}
