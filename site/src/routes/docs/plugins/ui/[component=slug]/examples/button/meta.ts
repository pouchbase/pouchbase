import type { UiComponent } from '#lib/ui-components.js';

export default {
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
} satisfies UiComponent;
