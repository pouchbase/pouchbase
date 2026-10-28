import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'skeleton',
	category: 'feedback',
	name: 'Skeleton',
	title: 'Skeleton',
	entry: 'skeleton',
	description: 'A pulsing placeholder in the shape of content that is still loading.',
	about: ['Size it with width and height classes. It is hidden from assistive technology.'],
	parts: [{ name: 'Root', description: 'The placeholder.', element: '<div>' }],
	examples: [{ id: 'basic', title: 'A loading card' }]
} satisfies UiComponent;
