import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'card',
	category: 'display',
	name: 'Card',
	title: 'Card',
	entry: 'card',
	description: 'A white panel with a border that groups related content, with an optional header.',
	parts: [
		{ name: 'Root', description: 'The panel.', element: '<div>' },
		{ name: 'Header', description: 'Holds the title and the description.', element: '<div>' },
		{ name: 'Title', description: 'The heading of the card.', element: '<h2>' },
		{ name: 'Description', description: 'A line under the title.', element: '<p>' },
		{ name: 'Content', description: 'The body, with padding.', element: '<div>' }
	],
	examples: [{ id: 'basic', title: 'Header and content' }]
} satisfies UiComponent;
