import type { SelectedBlock } from './email-editor-blocks';
import { updateBlock } from './email-editor-blocks';
import type { EmailEditorContext } from './email-editor-context';

/** Shared by the inspector's per-block settings (`email-editor-inspector-<type>.svelte`). */

export const ALIGN_OPTIONS = [
	{ value: 'left', label: 'Left', icon: 'lucide:align-left' },
	{ value: 'center', label: 'Center', icon: 'lucide:align-center' },
	{ value: 'right', label: 'Right', icon: 'lucide:align-right' }
] as const;

/** Sets attributes of the selected block, once the editor has mounted. */
export function updateSelectedBlock(
	context: EmailEditorContext,
	block: SelectedBlock,
	attrs: Record<string, unknown>
) {
	if (context.editor) {
		updateBlock(context.editor, block.position, attrs);
	}
}

/** A unique id for one of the block's fields. */
export function fieldId(block: SelectedBlock, name: string) {
	return `email-block-${block.position}-${name}`;
}
