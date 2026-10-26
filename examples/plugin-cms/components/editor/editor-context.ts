import { createContext } from 'svelte';

import type { Block, BlockType } from '../../lib/blocks.js';

/** Where the caret goes in a block that gets the focus: its start, end or a text offset. */
export type CaretPlace = 'start' | 'end' | number;

/**
 * What the blocks of the editor do to the post, shared by `post-editor.svelte` with every block,
 * its toolbar and the inserter. `blocks` and `selected` are getters, so they stay current.
 */
export interface EditorContext {
	readonly blocks: Block[];
	/** The id of the block with the toolbar, the last one that had the focus. */
	readonly selected: string | null;
	select(id: string | null): void;
	/** Adds `block` after the block `after` (`null`: at the end) and focuses it. */
	insert(block: Block, after: string | null): void;
	/** Puts `block` in the place of the block `id`, e.g. when the `/` menu picks a type. */
	replace(id: string, block: Block): void;
	/** Removes a block and focuses the end of the one before it (or the next one). */
	remove(id: string): void;
	move(id: string, delta: -1 | 1): void;
	/** Turns a block into another type, keeping its text where the new type has text. */
	transform(id: string, type: BlockType): void;
	/** Backspace at the start of a text block: appends it to the block before, if that has text. */
	mergeWithPrevious(id: string): boolean;
	focus(id: string, where?: CaretPlace): void;
	/** Moves the focus to the block before (`-1`) or after (`1`); `false` when there is none. */
	focusSibling(id: string, delta: -1 | 1): boolean;
}

export const [getEditorContext, setEditorContext] = createContext<EditorContext>();
