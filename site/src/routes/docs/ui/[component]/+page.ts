import type { Component } from 'svelte';
import type { PageLoad } from './$types';

// Loaded per page, so a page only ships the examples of its own component.
const previews = import.meta.glob<Component>('./examples/*/*.svelte', { import: 'default' });

export const load: PageLoad = async ({ data }) => {
	const examples = await Promise.all(
		data.component.examples.map(async (example) => ({
			...example,
			preview: await previews[`./examples/${data.component.slug}/${example.id}.svelte`](),
			code: data.code[example.id]
		}))
	);

	return { ...data, examples };
};
