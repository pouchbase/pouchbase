import type { UiComponent } from '#lib/ui-components.js';
import { classProp } from '#lib/ui-props.js';

export default {
	slug: 'spinner',
	category: 'feedback',
	name: 'Spinner',
	title: 'Spinner',
	entry: 'spinner',
	description: 'A spinning ring that shows something is busy.',
	about: [
		'Buttons show one by themselves while busy (see [Button](/docs/ui/button)). Give a spinner on its own a `label`, so assistive technology announces it.'
	],
	parts: [
		{
			name: 'Root',
			description: 'The spinner.',
			props: [
				{
					name: 'label',
					type: 'string',
					description:
						'Accessible label; leave it out inside a control that is already `aria-busy`.'
				},
				classProp
			]
		}
	],
	examples: [{ id: 'basic', title: 'Sizes' }]
} satisfies UiComponent;
