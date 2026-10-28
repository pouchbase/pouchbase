import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'textarea',
	category: 'forms',
	name: 'Textarea',
	title: 'Textarea',
	entry: 'inputs/textarea',
	description: 'A multi-line text input.',
	parts: [
		{
			name: 'Root',
			description: 'A `<textarea>`, at least `6rem` high.',
			element: '<textarea>',
			props: [
				{ name: 'value', type: 'string', description: 'Bindable: the value.' },
				{ name: 'ref', type: 'HTMLTextAreaElement | null', description: 'Bindable: the element.' }
			]
		}
	],
	examples: [{ id: 'basic', title: 'With a label' }]
} satisfies UiComponent;
