<script lang="ts">
	import * as Cropper from '#lib/components/ui/cropper/index.js';
	import { getImageEditorContext } from './image-editor-context.js';

	const editor = getImageEditorContext();
</script>

<div class="relative flex min-h-64 items-center justify-center rounded-lg bg-zinc-100 p-4">
	{#if editor.tab === 'crop'}
		<Cropper.Root
			width={editor.size.width}
			height={editor.size.height}
			bind:area={editor.edit.area}
			aspect={editor.aspectRatio(editor.edit.aspect)}
			maxHeight="60svh"
			oncommit={editor.commit}
		>
			<canvas {@attach editor.draw(null)} class="block size-full" style:filter={editor.filter}
			></canvas>
		</Cropper.Root>
	{:else}
		<!-- Outside the crop tab, the preview shows the result: only the selected area. -->
		<canvas
			{@attach editor.draw(editor.edit.area)}
			class="block h-auto max-h-[60svh] w-auto max-w-full rounded-sm shadow-sm"
			style:filter={editor.filter}
		></canvas>
	{/if}

	{#if editor.comparing}
		<span
			class="absolute top-3 left-3 rounded-md bg-zinc-900/80 px-2 py-1 text-xs font-medium text-white"
		>
			Original
		</span>
	{/if}
</div>
