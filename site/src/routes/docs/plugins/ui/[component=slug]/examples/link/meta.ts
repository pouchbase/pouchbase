import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'link',
	category: 'display',
	name: 'Link',
	title: 'Link',
	entry: 'link',
	description:
		'An inline text link that keeps the color of the text around it and underlines on hover.',
	parts: [
		{
			name: 'Root',
			description: 'An `<a>`.',
			element: '<a>',
			props: [{ name: 'href', type: 'string', description: 'Required.' }]
		}
	],
	examples: [{ id: 'basic', title: 'In a table cell' }]
} satisfies UiComponent;
