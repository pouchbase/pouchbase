import type { EntryGenerator, PageServerLoad } from './$types';

import { snippet } from '#lib/highlight.js';
import { highlight } from '#lib/server/highlight.js';
import { uiComponents } from '#lib/ui-components.js';
import { error } from '@sveltejs/kit';

// The source of every example, inlined at build time; `+page.ts` loads the same files as components.
const sources = import.meta.glob<string>('./examples/*/*.svelte', {
	query: '?raw',
	import: 'default',
	eager: true
});

export const entries: EntryGenerator = () =>
	uiComponents.map((component) => ({ component: component.slug }));

export const load: PageServerLoad = ({ params }) => {
	const component = uiComponents.find((item) => item.slug === params.component);

	if (!component) {
		error(404, 'Not found');
	}

	const importCode = highlight(
		snippet(
			'typescript',
			`import * as ${component.name} from '@pouchbasejs/ui/${component.entry}';`
		)
	);

	const code = Object.fromEntries(
		component.examples.map((example) => {
			const source = sources[`./examples/${component.slug}/${example.id}.svelte`];

			// Unix line endings whatever the checkout has.
			return [example.id, highlight(snippet('svelte', source.replace(/\r\n/g, '\n')))];
		})
	);

	return { component, importCode, code };
};
