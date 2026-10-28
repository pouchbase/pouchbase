import type { UiComponent } from '#lib/ui-components.js';
import { ariaLabels, classProp } from '#lib/ui-props.js';

export default {
	slug: 'meter',
	category: 'feedback',
	name: 'Meter',
	title: 'Meter',
	entry: 'meter',
	description:
		'Usage against a quota, such as storage or requests, colored by how close it is to the limit.',
	about: [
		"For how far a task has got, use [Progress](/docs/ui/progress). The meter doesn't pick the status itself: the dashboard uses `warning` from 80% and `exceeded` from 100%."
	],
	parts: [
		{
			name: 'Root',
			description: 'The bar, a `meter` for assistive technology.',
			props: [
				{ name: 'value', type: 'number', description: 'Required: the usage.' },
				{ name: 'max', type: 'number', description: 'Required: the quota.' },
				{
					name: 'status',
					type: "'ok' | 'warning' | 'exceeded'",
					default: "'ok'",
					description: 'The color of the fill.'
				},
				{
					name: 'aria-valuetext',
					type: 'string',
					description: 'The spoken value, e.g. `12,300 of 100,000 requests`.'
				},
				...ariaLabels,
				classProp,
				{ name: 'ref', type: 'HTMLDivElement | null', description: 'Bindable: the element.' }
			]
		}
	],
	examples: [{ id: 'statuses', title: 'Statuses' }]
} satisfies UiComponent;
