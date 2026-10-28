import type { UiComponent } from '#lib/ui-components.js';
import { ariaLabels, classProp } from '#lib/ui-props.js';

export default {
	slug: 'slider',
	category: 'forms',
	name: 'Slider',
	title: 'Slider',
	entry: 'inputs/slider',
	description: 'Picks a number in a range by dragging, or with the arrow keys.',
	parts: [
		{
			name: 'Root',
			description: 'The track and its thumb.',
			props: [
				{ name: 'value', type: 'number', default: '0', description: 'Bindable: the value.' },
				{ name: 'min', type: 'number', default: '0', description: 'The lowest value.' },
				{ name: 'max', type: 'number', default: '100', description: 'The highest value.' },
				{ name: 'step', type: 'number', default: '1', description: 'The step between values.' },
				{
					name: 'onValueChange',
					type: '(value: number) => void',
					description: 'Called while the value changes.'
				},
				{
					name: 'onValueCommit',
					type: '(value: number) => void',
					description: 'Called when the user is done: the pointer is released or a key pressed.'
				},
				{ name: 'id', type: 'string', description: 'The id of the thumb, for a `<label for>`.' },
				{
					name: 'disabled',
					type: 'boolean',
					default: 'false',
					description: 'Disables the slider.'
				},
				...ariaLabels,
				classProp
			]
		}
	],
	examples: [{ id: 'basic', title: 'With a value' }]
} satisfies UiComponent;
