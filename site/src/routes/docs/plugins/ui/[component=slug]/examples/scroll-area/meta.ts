import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'scroll-area',
	category: 'display',
	name: 'ScrollArea',
	title: 'Scroll area',
	entry: 'scroll-area',
	description: 'A scrolling container with slim scrollbars that look the same in every browser.',
	about: [
		'Limit the height of the scrolling element with `viewportClass`, e.g. `max-h-64`. [Table](/docs/ui/table) and [Select](/docs/ui/select) use it already.'
	],
	parts: [
		{
			name: 'Root',
			description: 'The container, with its scrollbars.',
			element: '<div>',
			props: [
				{
					name: 'viewportClass',
					type: 'string',
					description: 'Classes for the scrolling element, e.g. a `max-h-*`.'
				},
				{
					name: 'orientation',
					type: "'vertical' | 'horizontal' | 'both'",
					default: "'vertical'",
					description: 'Which scrollbars to show.'
				},
				{
					name: 'type',
					type: "'hover' | 'scroll' | 'auto' | 'always'",
					default: "'hover'",
					description: 'When the scrollbars show, as in the `ScrollArea` of bits-ui.'
				},
				{ name: 'ref', type: 'HTMLElement | null', description: 'Bindable: the element.' }
			]
		},
		{
			name: 'Scrollbar',
			description:
				'One scrollbar; `Root` adds them for you. Takes the props of the bits-ui `ScrollArea.Scrollbar`.',
			props: [{ name: 'orientation', type: "'vertical' | 'horizontal'", description: 'Required.' }]
		}
	],
	examples: [
		{ id: 'vertical', title: 'Vertical' },
		{ id: 'horizontal', title: 'Horizontal' }
	]
} satisfies UiComponent;
