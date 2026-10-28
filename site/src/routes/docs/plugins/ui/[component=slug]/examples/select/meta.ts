import type { UiComponent } from '#lib/ui-components.js';
import { ariaLabels, classProp } from '#lib/ui-props.js';

export default {
	slug: 'select',
	category: 'forms',
	name: 'Select',
	title: 'Select',
	entry: 'inputs/select',
	description:
		'A dropdown to pick one value from a list, with icons, images, descriptions and groups.',
	about: [
		'Built on the `Select` of bits-ui, with keyboard support and type-ahead. With `name`, a hidden input submits the value with a form.'
	],
	parts: [
		{
			name: 'Root',
			description: 'The trigger and its list.',
			props: [
				{
					name: 'items',
					type: 'Item[]',
					description:
						'Required: the options; see [Icons, descriptions and groups](/docs/ui/select#rich).'
				},
				{
					name: 'value',
					type: 'string',
					default: "''",
					description: 'Bindable: the picked value.'
				},
				{
					name: 'onValueChange',
					type: '(value: string) => void',
					description: 'Called with the picked value.'
				},
				{ name: 'name', type: 'string', description: 'Name of the hidden input, for forms.' },
				{
					name: 'placeholder',
					type: 'string',
					default: "'Select…'",
					description: 'Shown when nothing is picked.'
				},
				{ name: 'id', type: 'string', description: 'For a `<label for>`.' },
				{
					name: 'disabled',
					type: 'boolean',
					default: 'false',
					description: 'Disables the select.'
				},
				{ name: 'aria-invalid', type: 'boolean', description: 'Marks the value as invalid.' },
				{
					name: 'aria-describedby',
					type: 'string',
					description: 'The id of a description or an error.'
				},
				...ariaLabels,
				classProp
			]
		}
	],
	examples: [
		{ id: 'basic', title: 'With a label' },
		{
			id: 'rich',
			title: 'Icons, descriptions and groups',
			description:
				'An item takes `value` and `label`, and optionally `description`, `icon` (an Iconify name), `iconSrc` (an SVG URL, as `src` of [Icon](/docs/ui/icon)), `image` (a thumbnail), `disabled` and `group`. Items of a group follow each other.'
		}
	]
} satisfies UiComponent;
