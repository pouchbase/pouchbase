import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'tile',
	category: 'display',
	name: 'Tile',
	title: 'Tile',
	entry: 'tile',
	description: 'A grid of tiles, each one a figure or an item with a title, a value and actions.',
	about: [
		'`Tile.Grid` is a list that fits as many 14rem columns as there is room for; each `Tile.Root` is an item.'
	],
	parts: [
		{ name: 'Grid', description: 'The responsive grid.', element: '<ul>' },
		{ name: 'Root', description: 'A tile.', element: '<li>' },
		{
			name: 'Header',
			description: 'Lays out the icon and the title in a row.',
			element: '<div>'
		},
		{ name: 'Icon', description: 'Holds an icon.', element: '<div>' },
		{ name: 'Title', description: 'The name, truncated when it is too long.', element: '<h3>' },
		{ name: 'Value', description: 'The one number the tile is about.', element: '<p>' },
		{ name: 'Description', description: 'A line of detail.', element: '<p>' },
		{
			name: 'Footer',
			description: 'Actions, pushed to the bottom so they line up across tiles.',
			element: '<div>'
		}
	],
	examples: [{ id: 'basic', title: 'Usage figures' }]
} satisfies UiComponent;
