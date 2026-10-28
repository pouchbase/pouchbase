import type { UiComponent } from '#lib/ui-components.js';
import { classProp } from '#lib/ui-props.js';

export default {
	slug: 'segmented',
	category: 'forms',
	name: 'Segmented',
	title: 'Segmented control',
	entry: 'segmented',
	description: 'A row of options of which one is always active, such as a view or a period.',
	about: [
		'Clicking the active item keeps it active. The indicator slides to the picked item before the parent updates `value`.'
	],
	parts: [
		{
			name: 'Root',
			description: 'The group.',
			props: [
				{ name: 'value', type: 'string', description: 'Required: the value of the active item.' },
				{
					name: 'onValueChange',
					type: '(value: string) => void',
					description: 'Called with the item that was picked.'
				},
				{
					name: 'aria-label',
					type: 'string',
					description: 'Required: names the group, e.g. `Layout`.'
				},
				{ name: 'disabled', type: 'boolean', description: 'Disables every item.' },
				classProp
			]
		},
		{
			name: 'Item',
			description: 'One option.',
			props: [
				{ name: 'value', type: 'string', description: 'Required.' },
				{
					name: 'aria-label',
					type: 'string',
					description: 'Required for items with only an icon.'
				},
				{ name: 'disabled', type: 'boolean', description: 'Disables the item.' },
				classProp
			]
		}
	],
	examples: [
		{ id: 'basic', title: 'Text' },
		{ id: 'icons', title: 'Icons', description: 'Give items with only an icon an `aria-label`.' }
	]
} satisfies UiComponent;
