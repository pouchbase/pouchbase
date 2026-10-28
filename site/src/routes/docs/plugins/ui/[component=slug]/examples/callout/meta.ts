import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'callout',
	category: 'feedback',
	name: 'Callout',
	title: 'Callout',
	entry: 'callout',
	description:
		'A short message next to the content that needs attention: a hint, a result, a warning or an error.',
	about: [
		'An `error` callout has `role="alert"`, so screen readers announce it right away; the others have `role="status"`.'
	],
	parts: [
		{
			name: 'Root',
			description: 'The box, which lays out the icon and the body.',
			element: '<div>',
			props: [
				{
					name: 'variant',
					type: "'info' | 'success' | 'warning' | 'error'",
					default: "'info'",
					description: 'The colors and the role.'
				}
			]
		},
		{
			name: 'Icon',
			description: 'Holds an icon, colored to match the variant.',
			element: '<div>'
		},
		{
			name: 'Body',
			description: 'Groups the title, the description and any actions.',
			element: '<div>'
		},
		{ name: 'Title', description: 'The message in a few words.', element: '<p>' },
		{ name: 'Description', description: 'The details.', element: '<p>' }
	],
	examples: [
		{ id: 'variants', title: 'Variants' },
		{
			id: 'actions',
			title: 'With an action',
			description: 'Put buttons in the body, under the description.'
		}
	]
} satisfies UiComponent;
