import { mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { BLOCK_DEFAULTS, BLOCK_MARGINS, blockMargins } from '#lib/mail/document.js';
import { ALIGN_MARGIN, css, stored } from './shared';

export const EmailImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			...stored({ width: BLOCK_DEFAULTS.image.width, align: 'center', href: null, radius: 0 })
		};
	},

	renderHTML({ node, HTMLAttributes }) {
		const spacing = blockMargins(node.attrs, BLOCK_MARGINS.image);
		const style = {
			width: node.attrs.width ? `${node.attrs.width}px` : '100%',
			'max-width': '100%',
			margin: ALIGN_MARGIN[node.attrs.align as keyof typeof ALIGN_MARGIN] ?? ALIGN_MARGIN.center,
			// After `margin`, which only places the image; the image is a block of its own.
			'margin-top': `${spacing.top}px`,
			'margin-bottom': `${spacing.bottom}px`,
			'border-radius': node.attrs.radius ? `${node.attrs.radius}px` : null
		};

		// An image from a variable is only known when the email is sent.
		if (typeof node.attrs.src === 'string' && node.attrs.src.includes('{{')) {
			return [
				'div',
				{ class: 'email-image-placeholder', style: css(style) },
				`Image: ${node.attrs.src}`
			];
		}

		return [
			'img',
			mergeAttributes(HTMLAttributes, {
				style: css({ display: 'block', height: 'auto', ...style })
			})
		];
	}
}).configure({ inline: false, allowBase64: false });
