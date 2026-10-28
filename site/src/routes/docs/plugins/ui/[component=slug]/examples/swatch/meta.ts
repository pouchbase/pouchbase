import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'swatch',
	category: 'display',
	name: 'Swatch',
	title: 'Swatch',
	entry: 'swatch',
	description: 'A pickable option shown as a picture with a label, such as a filter preset.',
	parts: [
		{
			name: 'Root',
			description: 'A toggle `<button>` with `aria-pressed`.',
			element: '<button>',
			props: [
				{ name: 'src', type: 'string', description: 'Required: the picture.' },
				{ name: 'filter', type: 'string', description: 'A CSS `filter` for the picture.' },
				{
					name: 'selected',
					type: 'boolean',
					default: 'false',
					description: 'Whether this option is the chosen one.'
				}
			]
		}
	],
	examples: [{ id: 'basic', title: 'Filter presets' }]
} satisfies UiComponent;
