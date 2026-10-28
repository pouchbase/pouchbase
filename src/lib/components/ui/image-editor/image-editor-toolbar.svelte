<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { isNeutral } from '#lib/files/image-edits.js';
	import { getImageEditorContext } from './image-editor-context.js';

	const editor = getImageEditorContext();
</script>

<div class="flex items-center gap-1">
	<Button.Root
		variant="ghost"
		size="icon"
		aria-label="Undo"
		title="Undo (Ctrl+Z)"
		disabled={!editor.past.length}
		onclick={editor.undo}
	>
		<Icon.Root icon="lucide:undo-2" />
	</Button.Root>
	<Button.Root
		variant="ghost"
		size="icon"
		aria-label="Redo"
		title="Redo (Ctrl+Shift+Z)"
		disabled={!editor.future.length}
		onclick={editor.redo}
	>
		<Icon.Root icon="lucide:redo-2" />
	</Button.Root>

	<span class="mx-1 h-5 w-px bg-zinc-200" aria-hidden="true"></span>

	<Button.Root
		variant="ghost"
		aria-pressed={editor.comparing}
		title="Hold to see the original colors"
		disabled={isNeutral(editor.edit.adjustments)}
		onpointerdown={() => (editor.comparing = true)}
		onpointerup={() => (editor.comparing = false)}
		onpointerleave={() => (editor.comparing = false)}
		onpointercancel={() => (editor.comparing = false)}
		onkeydown={(event: KeyboardEvent) => editor.compareKey(event, true)}
		onkeyup={(event: KeyboardEvent) => editor.compareKey(event, false)}
		onblur={() => (editor.comparing = false)}
	>
		<Icon.Root icon="lucide:split-square-horizontal" />
		Compare
	</Button.Root>

	<span
		class={['ml-auto text-xs tabular-nums', editor.tooLarge ? 'text-red-600' : 'text-zinc-500']}
		aria-live="polite"
	>
		{editor.outputWidth} × {editor.outputHeight} px
	</span>
</div>
