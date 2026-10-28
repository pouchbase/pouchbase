import { Extension } from '@tiptap/core';
import { BLOCK_MARGINS } from '#lib/mail/document.js';

/** A margin from the document: a number of pixels, or `null` for the block's default. */
function marginAttribute(side: 'top' | 'bottom') {
	const data = `data-margin-${side}`;

	return {
		default: null,
		// Only from the editor's own HTML (copy and paste), not from margins of pasted web pages.
		parseHTML: (element: HTMLElement) => {
			const value = element.getAttribute(data);

			return value === null ? null : Number(value);
		},
		renderHTML: (attributes: Record<string, unknown>) => {
			const value = attributes[side === 'top' ? 'marginTop' : 'marginBottom'];

			return typeof value === 'number' ? { [data]: value, style: `margin-${side}:${value}px` } : {};
		}
	};
}

/**
 * The space above and below blocks (`marginTop`, `marginBottom`), for every block that has a
 * default in `BLOCK_MARGINS`. The canvas draws the defaults with CSS; set margins override them.
 */
export const BlockMargins = Extension.create({
	name: 'blockMargins',

	addGlobalAttributes() {
		return [
			{
				types: Object.keys(BLOCK_MARGINS),
				attributes: { marginTop: marginAttribute('top'), marginBottom: marginAttribute('bottom') }
			}
		];
	}
});
