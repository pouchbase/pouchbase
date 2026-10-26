/**
 * The caret in a `contenteditable` block: where it is, moving it, and splitting the block at it.
 * Browser only; the editor's keyboard handling (Enter splits a block, Backspace at the start
 * merges it into the one before, arrows move between blocks) is built on these.
 */

function selectionRange(element: HTMLElement) {
	const selection = getSelection();

	if (!selection?.rangeCount) {
		return null;
	}

	const range = selection.getRangeAt(0);

	return element.contains(range.startContainer) ? range : null;
}

/** The text from the start of `element` to the caret. */
function textBefore(element: HTMLElement, range: Range) {
	const before = document.createRange();

	before.selectNodeContents(element);
	before.setEnd(range.startContainer, range.startOffset);

	return before.toString();
}

/** The text from the caret to the end of `element`. */
function textAfter(element: HTMLElement, range: Range) {
	const after = document.createRange();

	after.selectNodeContents(element);
	after.setStart(range.endContainer, range.endOffset);

	return after.toString();
}

export function caretAtStart(element: HTMLElement) {
	const range = selectionRange(element);

	return !!range && range.collapsed && textBefore(element, range) === '';
}

export function caretAtEnd(element: HTMLElement) {
	const range = selectionRange(element);

	return !!range && range.collapsed && textAfter(element, range) === '';
}

/** Puts the caret `offset` characters into the text of `element`, or at its start or end. */
export function placeCaret(element: HTMLElement, where: 'start' | 'end' | number) {
	element.focus();

	const selection = getSelection();
	const range = document.createRange();

	if (where === 'start' || where === 'end') {
		range.selectNodeContents(element);
		range.collapse(where === 'start');
	} else {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let left = where;
		let node = walker.nextNode();

		range.selectNodeContents(element);
		range.collapse(false);

		while (node) {
			const length = node.textContent?.length ?? 0;

			if (left <= length) {
				range.setStart(node, left);
				range.collapse(true);
				break;
			}

			left -= length;
			node = walker.nextNode();
		}
	}

	selection?.removeAllRanges();
	selection?.addRange(range);
}

/** The length of the text of `element`, to put the caret where two merged blocks meet. */
export function textLength(element: HTMLElement) {
	return element.textContent?.length ?? 0;
}

/**
 * Deletes the selection, then cuts `element` at the caret: it keeps what is before, and the HTML
 * of what was after is returned, for a new block. `null` without a caret in `element`.
 */
export function splitAtCaret(element: HTMLElement) {
	const range = selectionRange(element);

	if (!range) {
		return null;
	}

	range.deleteContents();

	const after = document.createRange();

	after.selectNodeContents(element);
	after.setStart(range.endContainer, range.endOffset);

	const holder = document.createElement('div');

	holder.append(after.extractContents());

	return { before: cleanEdge(element.innerHTML), after: cleanEdge(holder.innerHTML) };
}

/** An empty `<b></b>` or a lone `<br>` left at a cut isn't content. */
function cleanEdge(html: string) {
	const cleaned = html.replace(/<(\w+)[^>]*>\s*<\/\1>/g, '');

	return /^\s*(<br\s*\/?>)?\s*$/i.test(cleaned) ? '' : cleaned;
}
