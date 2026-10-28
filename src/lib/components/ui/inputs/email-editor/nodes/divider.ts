import { mergeAttributes } from '@tiptap/core';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { BLOCK_DEFAULTS } from '#lib/mail/document.js';
import { css, stored } from './shared';

export const EmailDivider = HorizontalRule.extend({
	addAttributes() {
		return stored({ color: null, thickness: BLOCK_DEFAULTS.divider.thickness });
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			'hr',
			mergeAttributes(HTMLAttributes, {
				style: css({
					border: 0,
					'border-top': `${node.attrs.thickness}px solid ${node.attrs.color ?? BLOCK_DEFAULTS.divider.color}`
				})
			})
		];
	}
});
