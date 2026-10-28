import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'checkbox',
	category: 'forms',
	name: 'Checkbox',
	title: 'Checkbox',
	entry: 'inputs/checkbox',
	description: "A native checkbox in the dashboard's style.",
	about: ['Link it to a `<label>` with `id` and `for`, or wrap it in the label.'],
	parts: [
		{
			name: 'Root',
			description: 'An `<input type="checkbox">`.',
			element: '<input>',
			props: [
				{ name: 'checked', type: 'boolean', description: 'Bindable: whether it is checked.' },
				{ name: 'ref', type: 'HTMLInputElement | null', description: 'Bindable: the element.' }
			]
		}
	],
	examples: [{ id: 'basic', title: 'With labels' }]
} satisfies UiComponent;
