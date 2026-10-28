import type { UiComponent } from '#lib/ui-components.js';
import { classProp } from '#lib/ui-props.js';

export default {
	slug: 'thumbnail',
	category: 'display',
	name: 'Thumbnail',
	title: 'Thumbnail',
	entry: 'thumbnail',
	description:
		'A small square image, with a fallback when there is none and an optional larger preview on hover.',
	parts: [
		{
			name: 'Root',
			description:
				'The image, or the fallback (`children`) when there is no `src` or it fails to load.',
			props: [
				{ name: 'src', type: 'string | null', description: 'The image URL.' },
				{
					name: 'preview',
					type: 'string | null',
					description: 'A larger image, shown in a tooltip on hover.'
				},
				{ name: 'alt', type: 'string', default: "''", description: 'The alternative text.' },
				{
					name: 'size',
					type: "'sm' | 'md' | 'lg' | 'fill'",
					default: "'md'",
					description: '24, 40 or 160 pixels, or `fill` for a square as wide as its container.'
				},
				classProp
			]
		}
	],
	examples: [
		{
			id: 'sizes',
			title: 'Sizes and fallbacks',
			description: 'The last one has no image and shows its icon.'
		},
		{ id: 'preview', title: 'Preview on hover' }
	]
} satisfies UiComponent;
