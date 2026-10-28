/**
 * Helpers shared by the email editor's nodes. Block attributes are what `#lib/mail/document.ts`
 * renders into the email; in the editor they are drawn with the same styles, with the email's
 * colors from CSS variables (`--mail-*`, set by the canvas).
 */

/** Attributes that are only stored in the document, not written into the editor's HTML. */
export function stored(values: Record<string, unknown>) {
	return Object.fromEntries(
		Object.entries(values).map(([name, value]) => [name, { default: value, rendered: false }])
	);
}

export function css(declarations: Record<string, string | number | null | undefined | false>) {
	return Object.entries(declarations)
		.filter(([, value]) => value !== null && value !== undefined && value !== false && value !== '')
		.map(([property, value]) => `${property}:${value}`)
		.join(';');
}

export const ALIGN_MARGIN = { left: '0 auto 0 0', center: '0 auto', right: '0 0 0 auto' } as const;
