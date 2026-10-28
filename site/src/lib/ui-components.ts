import { resolve } from '$app/paths';

/**
 * The components of `@pouchbasejs/ui` (`packages/ui`), documented under `/docs/ui`. Text may use
 * `backticks` for inline code and [links](/docs/ui/<slug>#<hash>) to these docs. Each example is a component in
 * `src/routes/docs/plugins/ui/[component=slug]/examples/<slug>/<example>.svelte`, shown as a live preview and as
 * its source.
 */

export interface UiProp {
	name: string;
	type: string;
	default?: string;
	description: string;
}

export interface UiPart {
	/** The export name, e.g. `Root` for `Card.Root`. */
	name: string;
	description: string;
	/**
	 * The element whose attributes the part takes (and passes on), e.g. `<div>`; it also takes
	 * `class`. Left out for parts with only the props listed.
	 */
	element?: string;
	props?: UiProp[];
}

export interface UiExample {
	/** The file name in `examples/<slug>/`, without `.svelte`. */
	id: string;
	title: string;
	description?: string;
}

export type UiCategory = 'forms' | 'feedback' | 'display';

/** The categories the components are grouped by, in the docs sidebar and on the overview. */
export const uiCategories: { id: UiCategory; title: string }[] = [
	{ id: 'forms', title: 'Forms and inputs' },
	{ id: 'feedback', title: 'Feedback and status' },
	{ id: 'display', title: 'Data display' }
];

export interface UiComponent {
	/** The URL segment, e.g. `input` for `/docs/ui/input`. */
	slug: string;
	category: UiCategory;
	/** The namespace it is imported as, e.g. `ScrollArea`. */
	name: string;
	title: string;
	/** The entry point below `@pouchbasejs/ui/`, e.g. `inputs/input`. */
	entry: string;
	/** One sentence, for the page's description and the overview. */
	description: string;
	/** Paragraphs of the page, before the examples. */
	about?: string[];
	parts: UiPart[];
	examples: UiExample[];
}

const classProp: UiProp = {
	name: 'class',
	type: 'string',
	description: 'Classes merged with the default ones.'
};

const ariaLabels: UiProp[] = [
	{
		name: 'aria-label',
		type: 'string',
		description: 'Names it for assistive technology when there is no visible label.'
	},
	{ name: 'aria-labelledby', type: 'string', description: 'The id of a visible label.' }
];

export const uiComponents: UiComponent[] = [
	{
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
	},
	{
		slug: 'button',
		category: 'forms',
		name: 'Button',
		title: 'Button',
		entry: 'button',
		description:
			'A button or a link that looks like one, with variants, icon sizes and a busy state.',
		about: [
			'Built on the `Button` of bits-ui: an `<a>` with `href`, otherwise a `<button type="button">`, which never submits a form unless you pass `type="submit"`.',
			"When `onclick` returns a promise, the button shows a spinner and blocks clicks until it settles; pass `loading` for work it doesn't start itself."
		],
		parts: [
			{
				name: 'Root',
				description: 'The button.',
				element: '<button> or <a>',
				props: [
					{
						name: 'variant',
						type: "'primary' | 'secondary' | 'ghost' | 'danger'",
						default: "'primary'",
						description: 'The colors.'
					},
					{
						name: 'size',
						type: "'default' | 'icon' | 'icon-sm'",
						default: "'default'",
						description:
							'`icon` is a square button for a single icon, `icon-sm` a smaller one for inline actions next to text. Give icon buttons an `aria-label`.'
					},
					{
						name: 'loading',
						type: 'boolean',
						default: 'false',
						description: 'Shows a spinner and blocks clicks.'
					},
					{
						name: 'onclick',
						type: '(event: MouseEvent) => unknown',
						description: 'When it returns a promise, the button is busy until the promise settles.'
					},
					{ name: 'href', type: 'string', description: 'Renders a link instead of a button.' },
					{ name: 'disabled', type: 'boolean', description: 'Disables the button.' },
					{ name: 'ref', type: 'HTMLElement | null', description: 'Bindable: the element.' }
				]
			}
		],
		examples: [
			{ id: 'variants', title: 'Variants' },
			{
				id: 'sizes',
				title: 'Icons and sizes',
				description: 'Icons go before or after the label. Icon-only buttons need an `aria-label`.'
			},
			{
				id: 'loading',
				title: 'Async actions',
				description:
					'The handler returns a promise, so the button shows the spinner until it is done.'
			}
		]
	},
	{
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
	},
	{
		slug: 'card',
		category: 'display',
		name: 'Card',
		title: 'Card',
		entry: 'card',
		description:
			'A white panel with a border that groups related content, with an optional header.',
		parts: [
			{ name: 'Root', description: 'The panel.', element: '<div>' },
			{ name: 'Header', description: 'Holds the title and the description.', element: '<div>' },
			{ name: 'Title', description: 'The heading of the card.', element: '<h2>' },
			{ name: 'Description', description: 'A line under the title.', element: '<p>' },
			{ name: 'Content', description: 'The body, with padding.', element: '<div>' }
		],
		examples: [{ id: 'basic', title: 'Header and content' }]
	},
	{
		slug: 'checkbox',
		category: 'forms',
		name: 'Checkbox',
		title: 'Checkbox',
		entry: 'inputs/checkbox',
		description: "A native checkbox in the dashboard's style.",
		about: ['Link it to a `<label>` with `id` and `for`, or wrap it in the label.'],
		parts: [
			{
				name: 'Root',
				description: 'An `<input type="checkbox">`.',
				element: '<input>',
				props: [
					{ name: 'checked', type: 'boolean', description: 'Bindable: whether it is checked.' },
					{ name: 'ref', type: 'HTMLInputElement | null', description: 'Bindable: the element.' }
				]
			}
		],
		examples: [{ id: 'basic', title: 'With labels' }]
	},
	{
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
	},
	{
		slug: 'icon',
		category: 'display',
		name: 'Icon',
		title: 'Icon',
		entry: 'icon',
		description:
			'An Iconify icon, or an SVG file drawn in the text color, at the size of the text.',
		about: [
			'`icon` is an Iconify name such as `lucide:plus`. In an app, the `iconify` Vite plugin bundles the icons it finds in the sources, so the name must appear literally (see [setup](/docs/ui#setup)).',
			"`src` is the URL of an SVG, such as a `data:` URL or a plugin's icon, drawn as a mask in `currentColor` so only its shape counts; it wins over `icon`. In a plugin, prefer `src`: names the dashboard doesn't bundle are fetched from the Iconify API.",
			'Icons are `1em` square in the text color, and hidden from assistive technology unless they have a `label`.'
		],
		parts: [
			{
				name: 'Root',
				description: 'An `<svg>`.',
				props: [
					{
						name: 'icon',
						type: 'string',
						description: 'Iconify name, e.g. `lucide:plus`; shown when there is no `src`.'
					},
					{
						name: 'src',
						type: 'string | null',
						description: 'URL of an SVG image, drawn in the text color.'
					},
					{
						name: 'label',
						type: 'string',
						description: 'Accessible label; without one the icon is decorative.'
					},
					classProp
				]
			}
		],
		examples: [
			{
				id: 'basic',
				title: 'Size and color',
				description: 'Size icons with `size-*` and color them with `text-*`.'
			},
			{
				id: 'src',
				title: 'An SVG file',
				description: 'A `data:` URL here; a plugin can also use the URL of one of its icons.'
			}
		]
	},
	{
		slug: 'input',
		category: 'forms',
		name: 'Input',
		title: 'Input',
		entry: 'inputs/input',
		description:
			'A single-line text input, for text, email, password, numbers, search and the other text-like types.',
		about: [
			'Mark an invalid value with `aria-invalid` and point `aria-describedby` at the error message. The `ghost` variant looks like plain text until it is hovered or focused, for editing in place.'
		],
		parts: [
			{
				name: 'Root',
				description: 'An `<input>`.',
				element: '<input>',
				props: [
					{ name: 'value', type: 'string | number', description: 'Bindable: the value.' },
					{ name: 'type', type: 'string', default: "'text'", description: 'The input type.' },
					{
						name: 'variant',
						type: "'default' | 'ghost'",
						default: "'default'",
						description: '`ghost` has no border or background until hovered or focused.'
					},
					{ name: 'ref', type: 'HTMLInputElement | null', description: 'Bindable: the element.' }
				]
			}
		],
		examples: [
			{ id: 'basic', title: 'With a label' },
			{
				id: 'states',
				title: 'States',
				description: 'Invalid, disabled, read-only and the `ghost` variant.'
			}
		]
	},
	{
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
	},
	{
		slug: 'meter',
		category: 'feedback',
		name: 'Meter',
		title: 'Meter',
		entry: 'meter',
		description:
			'Usage against a quota, such as storage or requests, colored by how close it is to the limit.',
		about: [
			"For how far a task has got, use [Progress](/docs/ui/progress). The meter doesn't pick the status itself: the dashboard uses `warning` from 80% and `exceeded` from 100%."
		],
		parts: [
			{
				name: 'Root',
				description: 'The bar, a `meter` for assistive technology.',
				props: [
					{ name: 'value', type: 'number', description: 'Required: the usage.' },
					{ name: 'max', type: 'number', description: 'Required: the quota.' },
					{
						name: 'status',
						type: "'ok' | 'warning' | 'exceeded'",
						default: "'ok'",
						description: 'The color of the fill.'
					},
					{
						name: 'aria-valuetext',
						type: 'string',
						description: 'The spoken value, e.g. `12,300 of 100,000 requests`.'
					},
					...ariaLabels,
					classProp,
					{ name: 'ref', type: 'HTMLDivElement | null', description: 'Bindable: the element.' }
				]
			}
		],
		examples: [{ id: 'statuses', title: 'Statuses' }]
	},
	{
		slug: 'progress',
		category: 'feedback',
		name: 'Progress',
		title: 'Progress',
		entry: 'progress',
		description: 'How far a task has got, such as an upload or moving files.',
		about: ['For usage against a quota, use [Meter](/docs/ui/meter).'],
		parts: [
			{
				name: 'Root',
				description: 'The bar, a `progressbar` for assistive technology.',
				props: [
					{ name: 'value', type: 'number', description: 'Required: what is done.' },
					{ name: 'max', type: 'number', description: 'Required: the total.' },
					{
						name: 'aria-valuetext',
						type: 'string',
						description: 'The spoken value, e.g. `12 of 40 files`.'
					},
					...ariaLabels,
					classProp,
					{ name: 'ref', type: 'HTMLDivElement | null', description: 'Bindable: the element.' }
				]
			}
		],
		examples: [{ id: 'basic', title: 'A running task' }]
	},
	{
		slug: 'scroll-area',
		category: 'display',
		name: 'ScrollArea',
		title: 'Scroll area',
		entry: 'scroll-area',
		description: 'A scrolling container with slim scrollbars that look the same in every browser.',
		about: [
			'Limit the height of the scrolling element with `viewportClass`, e.g. `max-h-64`. [Table](/docs/ui/table) and [Select](/docs/ui/select) use it already.'
		],
		parts: [
			{
				name: 'Root',
				description: 'The container, with its scrollbars.',
				element: '<div>',
				props: [
					{
						name: 'viewportClass',
						type: 'string',
						description: 'Classes for the scrolling element, e.g. a `max-h-*`.'
					},
					{
						name: 'orientation',
						type: "'vertical' | 'horizontal' | 'both'",
						default: "'vertical'",
						description: 'Which scrollbars to show.'
					},
					{
						name: 'type',
						type: "'hover' | 'scroll' | 'auto' | 'always'",
						default: "'hover'",
						description: 'When the scrollbars show, as in the `ScrollArea` of bits-ui.'
					},
					{ name: 'ref', type: 'HTMLElement | null', description: 'Bindable: the element.' }
				]
			},
			{
				name: 'Scrollbar',
				description:
					'One scrollbar; `Root` adds them for you. Takes the props of the bits-ui `ScrollArea.Scrollbar`.',
				props: [
					{ name: 'orientation', type: "'vertical' | 'horizontal'", description: 'Required.' }
				]
			}
		],
		examples: [
			{ id: 'vertical', title: 'Vertical' },
			{ id: 'horizontal', title: 'Horizontal' }
		]
	},
	{
		slug: 'segmented',
		category: 'forms',
		name: 'Segmented',
		title: 'Segmented control',
		entry: 'segmented',
		description: 'A row of options of which one is always active, such as a view or a period.',
		about: [
			'Clicking the active item keeps it active. The indicator slides to the picked item before the parent updates `value`.'
		],
		parts: [
			{
				name: 'Root',
				description: 'The group.',
				props: [
					{ name: 'value', type: 'string', description: 'Required: the value of the active item.' },
					{
						name: 'onValueChange',
						type: '(value: string) => void',
						description: 'Called with the item that was picked.'
					},
					{
						name: 'aria-label',
						type: 'string',
						description: 'Required: names the group, e.g. `Layout`.'
					},
					{ name: 'disabled', type: 'boolean', description: 'Disables every item.' },
					classProp
				]
			},
			{
				name: 'Item',
				description: 'One option.',
				props: [
					{ name: 'value', type: 'string', description: 'Required.' },
					{
						name: 'aria-label',
						type: 'string',
						description: 'Required for items with only an icon.'
					},
					{ name: 'disabled', type: 'boolean', description: 'Disables the item.' },
					classProp
				]
			}
		],
		examples: [
			{ id: 'basic', title: 'Text' },
			{ id: 'icons', title: 'Icons', description: 'Give items with only an icon an `aria-label`.' }
		]
	},
	{
		slug: 'select',
		category: 'forms',
		name: 'Select',
		title: 'Select',
		entry: 'inputs/select',
		description:
			'A dropdown to pick one value from a list, with icons, images, descriptions and groups.',
		about: [
			'Built on the `Select` of bits-ui, with keyboard support and type-ahead. With `name`, a hidden input submits the value with a form.'
		],
		parts: [
			{
				name: 'Root',
				description: 'The trigger and its list.',
				props: [
					{
						name: 'items',
						type: 'Item[]',
						description:
							'Required: the options; see [Icons, descriptions and groups](/docs/ui/select#rich).'
					},
					{
						name: 'value',
						type: 'string',
						default: "''",
						description: 'Bindable: the picked value.'
					},
					{
						name: 'onValueChange',
						type: '(value: string) => void',
						description: 'Called with the picked value.'
					},
					{ name: 'name', type: 'string', description: 'Name of the hidden input, for forms.' },
					{
						name: 'placeholder',
						type: 'string',
						default: "'Select…'",
						description: 'Shown when nothing is picked.'
					},
					{ name: 'id', type: 'string', description: 'For a `<label for>`.' },
					{
						name: 'disabled',
						type: 'boolean',
						default: 'false',
						description: 'Disables the select.'
					},
					{ name: 'aria-invalid', type: 'boolean', description: 'Marks the value as invalid.' },
					{
						name: 'aria-describedby',
						type: 'string',
						description: 'The id of a description or an error.'
					},
					...ariaLabels,
					classProp
				]
			}
		],
		examples: [
			{ id: 'basic', title: 'With a label' },
			{
				id: 'rich',
				title: 'Icons, descriptions and groups',
				description:
					'An item takes `value` and `label`, and optionally `description`, `icon` (an Iconify name), `iconSrc` (an SVG URL, as `src` of [Icon](/docs/ui/icon)), `image` (a thumbnail), `disabled` and `group`. Items of a group follow each other.'
			}
		]
	},
	{
		slug: 'skeleton',
		category: 'feedback',
		name: 'Skeleton',
		title: 'Skeleton',
		entry: 'skeleton',
		description: 'A pulsing placeholder in the shape of content that is still loading.',
		about: ['Size it with width and height classes. It is hidden from assistive technology.'],
		parts: [{ name: 'Root', description: 'The placeholder.', element: '<div>' }],
		examples: [{ id: 'basic', title: 'A loading card' }]
	},
	{
		slug: 'slider',
		category: 'forms',
		name: 'Slider',
		title: 'Slider',
		entry: 'inputs/slider',
		description: 'Picks a number in a range by dragging, or with the arrow keys.',
		parts: [
			{
				name: 'Root',
				description: 'The track and its thumb.',
				props: [
					{ name: 'value', type: 'number', default: '0', description: 'Bindable: the value.' },
					{ name: 'min', type: 'number', default: '0', description: 'The lowest value.' },
					{ name: 'max', type: 'number', default: '100', description: 'The highest value.' },
					{ name: 'step', type: 'number', default: '1', description: 'The step between values.' },
					{
						name: 'onValueChange',
						type: '(value: number) => void',
						description: 'Called while the value changes.'
					},
					{
						name: 'onValueCommit',
						type: '(value: number) => void',
						description: 'Called when the user is done: the pointer is released or a key pressed.'
					},
					{ name: 'id', type: 'string', description: 'The id of the thumb, for a `<label for>`.' },
					{
						name: 'disabled',
						type: 'boolean',
						default: 'false',
						description: 'Disables the slider.'
					},
					...ariaLabels,
					classProp
				]
			}
		],
		examples: [{ id: 'basic', title: 'With a value' }]
	},
	{
		slug: 'spinner',
		category: 'feedback',
		name: 'Spinner',
		title: 'Spinner',
		entry: 'spinner',
		description: 'A spinning ring that shows something is busy.',
		about: [
			'Buttons show one by themselves while busy (see [Button](/docs/ui/button)). Give a spinner on its own a `label`, so assistive technology announces it.'
		],
		parts: [
			{
				name: 'Root',
				description: 'The spinner.',
				props: [
					{
						name: 'label',
						type: 'string',
						description:
							'Accessible label; leave it out inside a control that is already `aria-busy`.'
					},
					classProp
				]
			}
		],
		examples: [{ id: 'basic', title: 'Sizes' }]
	},
	{
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
	},
	{
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
	},
	{
		slug: 'textarea',
		category: 'forms',
		name: 'Textarea',
		title: 'Textarea',
		entry: 'inputs/textarea',
		description: 'A multi-line text input.',
		parts: [
			{
				name: 'Root',
				description: 'A `<textarea>`, at least `6rem` high.',
				element: '<textarea>',
				props: [
					{ name: 'value', type: 'string', description: 'Bindable: the value.' },
					{ name: 'ref', type: 'HTMLTextAreaElement | null', description: 'Bindable: the element.' }
				]
			}
		],
		examples: [{ id: 'basic', title: 'With a label' }]
	},
	{
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
	},
	{
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
	},
	{
		slug: 'tooltip',
		category: 'feedback',
		name: 'Tooltip',
		title: 'Tooltip',
		entry: 'tooltip',
		description:
			'A short label that shows when the pointer rests on, or the keyboard focuses, an element.',
		about: [
			'Built on the `Tooltip` of bits-ui; each tooltip brings its own provider. The trigger is a `<button>`; to use another element, such as a [Button](/docs/ui/button), render it in the `child` snippet with the `props` it gets.'
		],
		parts: [
			{
				name: 'Root',
				description:
					'Holds the trigger and the content. Takes the props of the bits-ui `Tooltip.Root`.',
				props: [
					{
						name: 'open',
						type: 'boolean',
						default: 'false',
						description: 'Bindable: whether it shows.'
					},
					{
						name: 'delayDuration',
						type: 'number',
						default: '300',
						description: 'Milliseconds before it shows.'
					}
				]
			},
			{
				name: 'Trigger',
				description:
					'What the tooltip is about. Takes the props of the bits-ui `Tooltip.Trigger`, including the `child` snippet.'
			},
			{
				name: 'Content',
				description:
					'The tooltip, in a portal. Takes the props of the bits-ui `Tooltip.Content`, such as `side`.',
				props: [
					{
						name: 'variant',
						type: "'text' | 'media'",
						default: "'text'",
						description:
							'`text` for a short label, `media` for an image or other content with its own size.'
					},
					{
						name: 'sideOffset',
						type: 'number',
						default: '4',
						description: 'The gap to the trigger, in pixels.'
					}
				]
			}
		],
		examples: [
			{ id: 'basic', title: 'On an icon button' },
			{
				id: 'media',
				title: 'An image',
				description: 'The `media` variant fits content such as an image.'
			}
		]
	}
];

/** The docs page of an import specifier, e.g. `@pouchbasejs/ui/inputs/input`, if it is one of the package. */
export function uiComponentHref(specifier: string) {
	if (specifier === '@pouchbasejs/ui') {
		return resolve('/docs/plugins/ui');
	}

	const component = uiComponents.find((item) => `@pouchbasejs/ui/${item.entry}` === specifier);

	return component
		? resolve('/docs/plugins/ui/[component=slug]', { component: component.slug })
		: undefined;
}
