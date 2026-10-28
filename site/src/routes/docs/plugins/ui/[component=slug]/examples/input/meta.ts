import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'input',
	category: 'forms',
	name: 'Input',
	title: 'Input',
	entry: 'inputs/input',
	description:
		'A single-line text input, for text, email, password, numbers, search and the other text-like types.',
	about: [
		'Mark an invalid value with `aria-invalid` and point `aria-describedby` at the error message. The `ghost` variant looks like plain text until it is hovered or focused, for editing in place.'
	],
	parts: [
		{
			name: 'Root',
			description: 'An `<input>`.',
			element: '<input>',
			props: [
				{ name: 'value', type: 'string | number', description: 'Bindable: the value.' },
				{ name: 'type', type: 'string', default: "'text'", description: 'The input type.' },
				{
					name: 'variant',
					type: "'default' | 'ghost'",
					default: "'default'",
					description: '`ghost` has no border or background until hovered or focused.'
				},
				{ name: 'ref', type: 'HTMLInputElement | null', description: 'Bindable: the element.' }
			]
		}
	],
	examples: [
		{ id: 'basic', title: 'With a label' },
		{
			id: 'states',
			title: 'States',
			description: 'Invalid, disabled, read-only and the `ghost` variant.'
		}
	]
} satisfies UiComponent;
