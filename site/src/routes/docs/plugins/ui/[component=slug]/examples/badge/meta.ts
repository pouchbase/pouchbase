import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'badge',
	category: 'feedback',
	name: 'Badge',
	title: 'Badge',
	entry: 'badge',
	description:
		'A small label for a status, a type or a count, which can also be a link or a button.',
	about: [
		'A `<span>`, a link with `href` or a button with `onclick`; links and buttons get a hover and a focus style.'
	],
	parts: [
		{
			name: 'Root',
			description: 'The badge.',
			element: '<span>, <a> or <button>',
			props: [
				{
					name: 'variant',
					type: "'neutral' | 'outline' | 'success' | 'warning' | 'danger'",
					default: "'neutral'",
					description: 'The colors.'
				},
				{ name: 'href', type: 'string', description: 'Makes the badge a link.' },
				{
					name: 'onclick',
					type: '(event: MouseEvent) => void',
					description: 'Makes the badge a button.'
				}
			]
		}
	],
	examples: [
		{ id: 'variants', title: 'Variants' },
		{
			id: 'interactive',
			title: 'Icons, links and buttons',
			description: 'Icons inside a badge are sized to fit.'
		}
	]
} satisfies UiComponent;
