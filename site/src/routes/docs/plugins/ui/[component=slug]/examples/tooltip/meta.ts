import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'tooltip',
	category: 'feedback',
	name: 'Tooltip',
	title: 'Tooltip',
	entry: 'tooltip',
	description:
		'A short label that shows when the pointer rests on, or the keyboard focuses, an element.',
	about: [
		'Built on the `Tooltip` of bits-ui; each tooltip brings its own provider. The trigger is a `<button>`; to use another element, such as a [Button](/docs/ui/button), render it in the `child` snippet with the `props` it gets.'
	],
	parts: [
		{
			name: 'Root',
			description:
				'Holds the trigger and the content. Takes the props of the bits-ui `Tooltip.Root`.',
			props: [
				{
					name: 'open',
					type: 'boolean',
					default: 'false',
					description: 'Bindable: whether it shows.'
				},
				{
					name: 'delayDuration',
					type: 'number',
					default: '300',
					description: 'Milliseconds before it shows.'
				}
			]
		},
		{
			name: 'Trigger',
			description:
				'What the tooltip is about. Takes the props of the bits-ui `Tooltip.Trigger`, including the `child` snippet.'
		},
		{
			name: 'Content',
			description:
				'The tooltip, in a portal. Takes the props of the bits-ui `Tooltip.Content`, such as `side`.',
			props: [
				{
					name: 'variant',
					type: "'text' | 'media'",
					default: "'text'",
					description:
						'`text` for a short label, `media` for an image or other content with its own size.'
				},
				{
					name: 'sideOffset',
					type: 'number',
					default: '4',
					description: 'The gap to the trigger, in pixels.'
				}
			]
		}
	],
	examples: [
		{ id: 'basic', title: 'On an icon button' },
		{
			id: 'media',
			title: 'An image',
			description: 'The `media` variant fits content such as an image.'
		}
	]
} satisfies UiComponent;
