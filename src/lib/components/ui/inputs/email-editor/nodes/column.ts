import { mergeAttributes, Node } from '@tiptap/core';
import { css, stored } from './shared';

export const EmailColumn = Node.create({
	name: 'emailColumn',
	content: 'block+',
	isolating: true,

	addAttributes() {
		return stored({ width: null, verticalAlign: 'top', backgroundColor: null, padding: 0 });
	},

	parseHTML() {
		return [{ tag: 'div[data-email-column]' }];
	},

	renderHTML({ node, HTMLAttributes }) {
		const { padding } = node.attrs;
		const align = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;

		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-email-column': '',
				class: 'email-column',
				style: css({
					flex: `${node.attrs.width ?? 1} 1 0`,
					'align-self': align[node.attrs.verticalAlign as keyof typeof align] ?? 'flex-start',
					background: node.attrs.backgroundColor,
					padding: padding ? `${padding}px ${padding}px ${Math.max(0, padding - 16)}px` : null,
					'border-radius': node.attrs.backgroundColor ? '6px' : null
				})
			}),
			0
		];
	}
});
