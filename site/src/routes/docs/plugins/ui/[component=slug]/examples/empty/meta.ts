import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'empty',
	category: 'feedback',
	name: 'Empty',
	title: 'Empty',
	entry: 'empty',
	description:
		'What a list or a page shows when there is nothing in it yet, and how to change that.',
	parts: [
		{ name: 'Root', description: 'The dashed box, centered.', element: '<div>' },
		{ name: 'Icon', description: 'Holds an icon.', element: '<div>' },
		{ name: 'Title', description: 'What is empty.', element: '<h3>' },
		{ name: 'Description', description: 'What to do about it.', element: '<p>' }
	],
	examples: [
		{
			id: 'basic',
			title: 'With an action',
			description: 'Add a button after the description for the first step.'
		}
	]
} satisfies UiComponent;
