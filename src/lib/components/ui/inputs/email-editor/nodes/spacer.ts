import { mergeAttributes, Node } from '@tiptap/core';
import { BLOCK_DEFAULTS } from '#lib/mail/document.js';
import { stored } from './shared';

export const EmailSpacer = Node.create({
	name: 'emailSpacer',
	group: 'block',
	atom: true,
	selectable: true,

	addAttributes() {
		return stored({ height: BLOCK_DEFAULTS.spacer.height });
	},

	parseHTML() {
		return [{ tag: 'div[data-email-spacer]' }];
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-email-spacer': '',
				class: 'email-spacer',
				style: `height:${node.attrs.height}px`
			})
		];
	}
});
