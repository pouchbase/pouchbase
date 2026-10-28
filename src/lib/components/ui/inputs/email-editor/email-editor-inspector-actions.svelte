<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import * as Button from '../../button/index.js';
	import * as Icon from '../../icon/index.js';
	import type { SelectedBlock } from './email-editor-blocks';
	import { canMoveBlock, deleteBlock, duplicateBlock, moveBlock } from './email-editor-blocks';

	let { editor, block }: { editor: Editor; block: SelectedBlock } = $props();
</script>

<Button.Root
	type="button"
	variant="ghost"
	size="icon-sm"
	aria-label="Move up"
	title="Move up"
	disabled={!canMoveBlock(editor, block.position, -1)}
	onclick={() => moveBlock(editor, block.position, -1)}
>
	<Icon.Root icon="lucide:arrow-up" />
</Button.Root>
<Button.Root
	type="button"
	variant="ghost"
	size="icon-sm"
	aria-label="Move down"
	title="Move down"
	disabled={!canMoveBlock(editor, block.position, 1)}
	onclick={() => moveBlock(editor, block.position, 1)}
>
	<Icon.Root icon="lucide:arrow-down" />
</Button.Root>
<Button.Root
	type="button"
	variant="ghost"
	size="icon-sm"
	aria-label="Duplicate"
	title="Duplicate"
	onclick={() => duplicateBlock(editor, block.position)}
>
	<Icon.Root icon="lucide:copy" />
</Button.Root>
<Button.Root
	type="button"
	variant="ghost"
	size="icon-sm"
	aria-label="Delete"
	title="Delete"
	class="hover:text-red-600"
	onclick={() => deleteBlock(editor, block.position)}
>
	<Icon.Root icon="lucide:trash-2" />
</Button.Root>
