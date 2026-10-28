<script lang="ts">
	import * as Slider from '#lib/components/ui/inputs/slider/index.js';
	import * as Segmented from '#lib/components/ui/segmented/index.js';
	import { OUTPUT_FORMATS } from '#lib/files/image-edits.js';
	import { getImageEditorContext } from './image-editor-context.js';

	const editor = getImageEditorContext();
	const uid = $props.id();
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 font-medium text-zinc-900">Format</legend>
	<Segmented.Root
		value={editor.edit.format}
		onValueChange={editor.chooseFormat}
		aria-label="Format"
		class="w-full"
	>
		{#each OUTPUT_FORMATS as format (format.value)}
			<Segmented.Item value={format.value} class="flex-1">{format.label}</Segmented.Item>
		{/each}
	</Segmented.Root>

	<ul class="flex flex-col gap-1 text-xs text-zinc-500">
		<li>Saved as <span class="font-mono text-zinc-900">{editor.outputName}</span></li>
		{#if editor.edit.format === 'image/jpeg' && editor.originalFormat !== 'image/jpeg'}
			<li>JPEG has no transparency; transparent areas become solid.</li>
		{/if}
		{#if editor.edit.format === 'image/webp'}
			<li>WebP is saved without loss of quality.</li>
		{/if}
		{#if editor.mimeType.toLowerCase() === 'image/gif'}
			<li>Animated GIFs keep only their first frame.</li>
		{/if}
	</ul>
</fieldset>

{#if editor.edit.format === 'image/jpeg'}
	<fieldset class="flex flex-col gap-1">
		<legend class="mb-2 font-medium text-zinc-900">Quality</legend>
		<div class="flex items-center justify-between text-xs text-zinc-500">
			<span id="{uid}-quality">Lower is smaller</span>
			<span class="tabular-nums">{editor.edit.quality}</span>
		</div>
		<Slider.Root
			bind:value={editor.edit.quality}
			min={1}
			max={100}
			aria-labelledby="{uid}-quality"
			onValueCommit={editor.commit}
		/>
	</fieldset>
{/if}
