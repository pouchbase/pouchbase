import { mergeAttributes, Node } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { BLOCK_DEFAULTS } from '#lib/mail/document.js';
import { resizedColumnWidths, rowWidths, setColumnWidths } from '../email-editor-columns';
import { stored } from './shared';

/** A handle on the left edge of every column but the first, to drag the border between two. */
function columnHandles(state: EditorState) {
	const handles: Decoration[] = [];

	state.doc.descendants((node, position) => {
		if (node.type.name !== 'emailColumns') {
			return;
		}

		node.forEach((_, offset, index) => {
			if (index === 0) {
				return;
			}

			handles.push(
				Decoration.widget(
					position + 1 + offset + 1,
					() => {
						const handle = document.createElement('div');

						handle.className = 'email-column-resizer';
						handle.contentEditable = 'false';
						handle.dataset.row = String(position);
						handle.dataset.index = String(index);
						handle.title = 'Drag to resize the columns';

						return handle;
					},
					{ side: -1, ignoreSelection: true, key: `column-resizer-${position}-${index}` }
				)
			);
		});
	});

	return DecorationSet.create(state.doc, handles);
}

/**
 * Drags the border before column `index` of the row at `position`. While dragging, the widths
 * change without undo steps; letting go makes it one change, so undo restores the old widths.
 */
function dragColumnBorder(view: EditorView, event: PointerEvent, handle: HTMLElement) {
	const position = Number(handle.dataset.row);
	const index = Number(handle.dataset.index);
	const row = view.state.doc.nodeAt(position);
	const width = handle.closest('.email-columns')?.getBoundingClientRect().width;

	if (!row || row.type.name !== 'emailColumns' || !width) {
		return;
	}

	const start = rowWidths(row);
	let current = start;

	const apply = (widths: number[], history: boolean) => {
		view.dispatch(
			setColumnWidths(view.state.tr, position, widths).setMeta('addToHistory', history)
		);
	};

	const move = (moveEvent: PointerEvent) => {
		const delta = ((moveEvent.clientX - event.clientX) / width) * 100;
		const next = resizedColumnWidths(start, index - 1, start[index - 1] + delta);

		if (next.some((value, i) => value !== current[i])) {
			current = next;
			apply(next, false);
		}
	};

	const stop = () => {
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', stop);
		window.removeEventListener('pointercancel', stop);
		document.body.classList.remove('email-column-resizing');

		if (current !== start) {
			apply(start, false);
			apply(current, true);
		}
	};

	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', stop);
	window.addEventListener('pointercancel', stop);
	document.body.classList.add('email-column-resizing');
}

export const EmailColumns = Node.create({
	name: 'emailColumns',
	group: 'block',
	content: 'emailColumn{1,4}',
	isolating: true,

	addAttributes() {
		return stored({ gap: BLOCK_DEFAULTS.columns.gap });
	},

	parseHTML() {
		return [{ tag: 'div[data-email-columns]' }];
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-email-columns': '',
				class: 'email-columns',
				style: `gap:${node.attrs.gap}px;--email-columns-gap:${node.attrs.gap}px`
			}),
			0
		];
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					decorations: (state) => (this.editor.isEditable ? columnHandles(state) : null),
					handleDOMEvents: {
						pointerdown: (view, event) => {
							const handle = (event.target as HTMLElement | null)?.closest<HTMLElement>(
								'.email-column-resizer'
							);

							if (!handle || !view.editable || event.button !== 0) {
								return false;
							}

							event.preventDefault();
							dragColumnBorder(view, event, handle);

							return true;
						}
					}
				}
			})
		];
	}
});
