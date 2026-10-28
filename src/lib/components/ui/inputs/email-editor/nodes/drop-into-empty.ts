import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/** Blocks that hold other blocks, and keep an empty paragraph to type in when they are empty. */
const CONTAINERS = new Set(['emailColumn', 'emailSection']);

/**
 * A block dropped into an empty column or section takes the place of its empty paragraph,
 * instead of landing next to it.
 */
export const DropIntoEmpty = Extension.create({
	name: 'dropIntoEmpty',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				appendTransaction(transactions, _, state) {
					if (!transactions.some((tr) => tr.getMeta('uiEvent') === 'drop')) {
						return null;
					}

					const { $from } = state.selection;

					for (let depth = $from.depth; depth > 0; depth--) {
						const container = $from.node(depth);

						if (!CONTAINERS.has(container.type.name)) {
							continue;
						}

						if (container.childCount !== 2) {
							return null;
						}

						const empty = [0, 1].find((index) => {
							const child = container.child(index);

							return child.type.name === 'paragraph' && child.content.size === 0;
						});

						if (empty === undefined) {
							return null;
						}

						const from = $from.start(depth) + (empty === 0 ? 0 : container.child(0).nodeSize);

						return state.tr.delete(from, from + container.child(empty).nodeSize);
					}

					return null;
				}
			})
		];
	}
});
