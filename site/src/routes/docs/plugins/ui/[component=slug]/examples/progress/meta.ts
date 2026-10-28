import type { UiComponent } from '#lib/ui-components.js';
import { ariaLabels, classProp } from '#lib/ui-props.js';

export default {
	slug: 'progress',
	category: 'feedback',
	name: 'Progress',
	title: 'Progress',
	entry: 'progress',
	description: 'How far a task has got, such as an upload or moving files.',
	about: ['For usage against a quota, use [Meter](/docs/ui/meter).'],
	parts: [
		{
			name: 'Root',
			description: 'The bar, a `progressbar` for assistive technology.',
			props: [
				{ name: 'value', type: 'number', description: 'Required: what is done.' },
				{ name: 'max', type: 'number', description: 'Required: the total.' },
				{
					name: 'aria-valuetext',
					type: 'string',
					description: 'The spoken value, e.g. `12 of 40 files`.'
				},
				...ariaLabels,
				classProp,
				{ name: 'ref', type: 'HTMLDivElement | null', description: 'Bindable: the element.' }
			]
		}
	],
	examples: [{ id: 'basic', title: 'A running task' }]
} satisfies UiComponent;
