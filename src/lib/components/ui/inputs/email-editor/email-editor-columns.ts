import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Fragment } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { columnWidths } from '#lib/mail/document.js';

/** Width presets per number of columns, in percent. */
export const COLUMN_LAYOUTS: Record<number, { label: string; widths: number[] }[]> = {
	1: [{ label: 'Full', widths: [100] }],
	2: [
		{ label: '1:1', widths: [50, 50] },
		{ label: '1:2', widths: [33, 67] },
		{ label: '2:1', widths: [67, 33] }
	],
	3: [
		{ label: '1:1:1', widths: [33, 34, 33] },
		{ label: '1:2:1', widths: [25, 50, 25] }
	],
	4: [{ label: '1:1:1:1', widths: [25, 25, 25, 25] }]
};

/**
 * Gives the columns these widths, adding or removing columns to match; the content of removed
 * columns moves into the last column that remains.
 */
export function setColumnLayout(editor: Editor, position: number, widths: number[]) {
	const { state } = editor;
	const node = state.doc.nodeAt(position);

	if (!node || node.type.name !== 'emailColumns') {
		return;
	}

	const columnType = state.schema.nodes.emailColumn;
	const existing: ProseMirrorNode[] = [];

	node.forEach((child) => existing.push(child));

	const columns = widths.map((width, index) => {
		const current = existing[index];

		if (!current) {
			return columnType.create({ width }, state.schema.nodes.paragraph.create());
		}

		// The last column takes the content of the columns that are removed.
		const extra =
			index === widths.length - 1
				? existing
						.slice(widths.length)
						.reduce((content, column) => content.append(column.content), Fragment.empty)
				: Fragment.empty;

		return columnType.create({ ...current.attrs, width }, current.content.append(extra));
	});

	editor.view.dispatch(
		state.tr.replaceWith(position + 1, position + node.nodeSize - 1, Fragment.fromArray(columns))
	);
}

/** The narrowest column, in percent; `columnWidths` ignores narrower ones. */
export const MIN_COLUMN_WIDTH = 10;

/** The widths of the columns of a row, in percent; they add up to 100. */
export function rowWidths(row: ProseMirrorNode) {
	return columnWidths(row.toJSON().content ?? []);
}

/** The column that gives or takes the difference when column `index` is resized. */
function neighborColumn(widths: number[], index: number) {
	return index < widths.length - 1 ? index + 1 : index - 1;
}

/** The widest column `index` can get, at the cost of the column next to it. */
export function maxColumnWidth(widths: number[], index: number) {
	const neighbor = neighborColumn(widths, index);

	return neighbor < 0 ? 100 : widths[index] + widths[neighbor] - MIN_COLUMN_WIDTH;
}

/**
 * The widths after giving column `index` `width` percent. The column next to it (the one before
 * it, for the last column) gives or takes the difference, so the others keep their width.
 */
export function resizedColumnWidths(widths: number[], index: number, width: number) {
	const neighbor = neighborColumn(widths, index);

	if (neighbor < 0) {
		return widths;
	}

	const pair = widths[index] + widths[neighbor];
	const next = Math.round(Math.min(Math.max(width, MIN_COLUMN_WIDTH), pair - MIN_COLUMN_WIDTH));
	const result = [...widths];

	result[index] = next;
	result[neighbor] = pair - next;

	return result;
}

/** Sets the widths of the columns of the row at `position` in `tr`. */
export function setColumnWidths(tr: Transaction, position: number, widths: number[]) {
	const row = tr.doc.nodeAt(position);

	if (!row || row.type.name !== 'emailColumns') {
		return tr;
	}

	row.forEach((column, offset, index) => {
		tr.setNodeMarkup(position + 1 + offset, undefined, { ...column.attrs, width: widths[index] });
	});

	return tr;
}

/** The row a column is in, and the column's index in it; `null` when it isn't in a row. */
export function columnRow(editor: Editor, columnPosition: number) {
	const $column = editor.state.doc.resolve(columnPosition);

	if ($column.parent.type.name !== 'emailColumns') {
		return null;
	}

	return { row: $column.parent, position: $column.before(), index: $column.index() };
}

/** Gives the column at `columnPosition` `width` percent; see `resizedColumnWidths`. */
export function resizeColumn(editor: Editor, columnPosition: number, width: number) {
	const parent = columnRow(editor, columnPosition);

	if (parent) {
		const widths = resizedColumnWidths(rowWidths(parent.row), parent.index, width);

		editor.view.dispatch(setColumnWidths(editor.state.tr, parent.position, widths));
	}
}
