import { mergeAttributes, Node } from '@tiptap/core';
import type { ButtonSize } from '#lib/mail/document.js';
import { BLOCK_DEFAULTS, BUTTON_SIZE_STYLES } from '#lib/mail/document.js';
import { css, stored } from './shared';

export const EmailButton = Node.create({
	name: 'emailButton',
	group: 'block',
	content: 'text*',
	marks: '',
	defining: true,

	addAttributes() {
		return {
			href: { default: '', parseHTML: (element) => element.getAttribute('href') ?? '' },
			...stored({
				size: BLOCK_DEFAULTS.button.size,
				backgroundColor: null,
				textColor: null,
				radius: BLOCK_DEFAULTS.button.radius,
				fullWidth: BLOCK_DEFAULTS.button.fullWidth
			})
		};
	},

	parseHTML() {
		return [{ tag: 'a[data-email-button]', priority: 100 }];
	},

	addKeyboardShortcuts() {
		return {
			// A label has one line: Enter continues with a paragraph below the button.
			Enter: ({ editor }) => {
				const { $from } = editor.state.selection;

				if ($from.parent.type.name !== this.name) {
					return false;
				}

				const after = $from.after();

				return editor
					.chain()
					.insertContentAt(after, { type: 'paragraph' })
					.setTextSelection(after + 1)
					.run();
			}
		};
	},

	renderHTML({ node, HTMLAttributes }) {
		const { href, ...rest } = HTMLAttributes;
		const size = BUTTON_SIZE_STYLES[node.attrs.size as ButtonSize] ?? BUTTON_SIZE_STYLES.medium;

		return [
			'div',
			mergeAttributes(rest, { 'data-email-button': '', 'data-href': href }),
			[
				'span',
				{
					class: 'email-button',
					style: css({
						display: node.attrs.fullWidth ? 'block' : 'inline-block',
						background: node.attrs.backgroundColor ?? 'var(--mail-button)',
						color: node.attrs.textColor ?? 'var(--mail-button-text)',
						'font-size': `${size.fontSize}px`,
						padding: size.padding,
						'border-radius': `${node.attrs.radius}px`
					})
				},
				0
			]
		];
	}
});
