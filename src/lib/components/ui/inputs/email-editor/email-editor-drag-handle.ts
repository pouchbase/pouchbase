import { NodeSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/** Helpers of the drag handle (`email-editor-drag-handle.svelte`), without its state. */

/** The blocks that can be dragged: those in the email, a section or a column. */
export const BLOCKS = '.email-canvas > *, .email-section > *, .email-column > *';

/** Height of the handle; it is centered on the block's first line. */
export const HANDLE_SIZE = 24;
export const FIRST_LINE = 32;
/** Width of the strip left of a block that leads to its handle (the handle and its gap). */
export const GUTTER = HANDLE_SIZE + 12;

/** The position of the node `element` draws, or `-1`. */
export function positionOf(view: EditorView, element: HTMLElement) {
	let found = -1;

	view.state.doc.descendants((_, position) => {
		if (found >= 0) {
			return false;
		}

		if (view.nodeDOM(position) === element) {
			found = position;

			return false;
		}

		return true;
	});

	return found;
}

/**
 * The left edge of the column resizer next to a block at the start of a column (see
 * `nodes/columns.ts`), or `Infinity`. The handle goes left of it: over the resizer, the
 * browser doesn't start dragging the handle.
 */
export function resizerStart(element: HTMLElement) {
	const resizer = element.parentElement?.querySelector<HTMLElement>(
		':scope > .email-column-resizer'
	);

	return resizer ? resizer.getBoundingClientRect().left : Infinity;
}

/**
 * Selects the block at `position` and hands it to ProseMirror's own drag, as if it were selected
 * and dragged: dropping it moves it to the drop cursor (into a column or section too), or copies
 * it with Alt/Ctrl.
 */
export function startBlockDrag(
	view: EditorView,
	block: HTMLElement,
	position: number,
	dataTransfer: DataTransfer,
	clientY: number
) {
	const selection = NodeSelection.create(view.state.doc, position);

	view.dispatch(view.state.tr.setSelection(selection));

	const slice = selection.content();
	const { dom, text } = view.serializeForClipboard(slice);
	const rect = block.getBoundingClientRect();

	dataTransfer.clearData();
	dataTransfer.setData('text/html', dom.innerHTML);
	dataTransfer.setData('text/plain', text);
	dataTransfer.effectAllowed = 'copyMove';
	// Held where the pointer is, level with the handle.
	dataTransfer.setDragImage(block, 0, Math.min(rect.height, Math.max(0, clientY - rect.top)));

	// `node` makes the drop remove exactly this block when it moves.
	view.dragging = { slice, move: true, node: selection } as EditorView['dragging'];
}
