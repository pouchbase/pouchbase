import type { UiComponent } from '#lib/ui-components.js';

export default {
	slug: 'table',
	category: 'display',
	name: 'Table',
	title: 'Table',
	entry: 'table',
	description: 'A table of rows and columns in a card that scrolls sideways when it is too wide.',
	parts: [
		{
			name: 'Root',
			description: 'The `<table>`, in a horizontal scroll area.',
			element: '<table>'
		},
		{ name: 'Header', description: 'The head of the table.', element: '<thead>' },
		{ name: 'Body', description: 'The rows.', element: '<tbody>' },
		{ name: 'Row', description: 'A row.', element: '<tr>' },
		{ name: 'Head', description: 'A column heading, with `scope="col"`.', element: '<th>' },
		{ name: 'Cell', description: 'A cell.', element: '<td>' }
	],
	examples: [{ id: 'basic', title: 'Records' }]
} satisfies UiComponent;
