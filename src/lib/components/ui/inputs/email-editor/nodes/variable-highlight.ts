import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/** Marks variable tags (`{{name}}`, `{{#each items}}`) so they stand out while writing. */
export const VariableHighlight = Extension.create({
	name: 'variableHighlight',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					decorations(state) {
						const decorations: Decoration[] = [];

						state.doc.descendants((node, position) => {
							if (!node.isText || !node.text) {
								return;
							}

							for (const match of node.text.matchAll(/\{\{[^{}]*\}\}/g)) {
								const start = position + match.index;
								const block = /^\{\{\s*(?:[#/]|else\b)/.test(match[0]);

								decorations.push(
									Decoration.inline(start, start + match[0].length, {
										class: block ? 'email-variable email-variable-block' : 'email-variable'
									})
								);
							}
						});

						return DecorationSet.create(state.doc, decorations);
					}
				}
			})
		];
	}
});
