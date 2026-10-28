import { mergeAttributes, Node } from '@tiptap/core';
import { BLOCK_DEFAULTS } from '#lib/mail/document.js';
import { css, stored } from './shared';

export const EmailSection = Node.create({
	name: 'emailSection',
	group: 'block',
	content: 'block+',
	isolating: true,
	defining: true,

	addAttributes() {
		return stored({
			backgroundColor: null,
			textColor: null,
			borderColor: null,
			padding: BLOCK_DEFAULTS.section.padding,
			radius: BLOCK_DEFAULTS.section.radius
		});
	},

	parseHTML() {
		return [{ tag: 'div[data-email-section]' }];
	},

	renderHTML({ node, HTMLAttributes }) {
		const { padding } = node.attrs;

		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-email-section': '',
				class: 'email-section',
				style: css({
					background: node.attrs.backgroundColor,
					color: node.attrs.textColor,
					border: node.attrs.borderColor ? `1px solid ${node.attrs.borderColor}` : null,
					padding: `${padding}px ${padding}px ${Math.max(0, padding - 16)}px`,
					'border-radius': `${node.attrs.radius}px`
				})
			}),
			0
		];
	}
});
