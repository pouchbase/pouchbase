<script lang="ts">
	import * as Swatch from '#lib/components/ui/swatch/index.js';
	import { cssFilter, FILTER_PRESETS, sameAdjustments } from '#lib/files/image-edits.js';
	import { getImageEditorContext } from './image-editor-context.js';

	const editor = getImageEditorContext();
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 font-medium text-zinc-900">Filters</legend>
	<div class="grid grid-cols-3 gap-2">
		{#each FILTER_PRESETS as preset (preset.name)}
			<Swatch.Root
				src={editor.image.src}
				filter={cssFilter(preset.adjustments)}
				selected={sameAdjustments(editor.edit.adjustments, preset.adjustments)}
				onclick={() => editor.choosePreset(preset.adjustments)}
			>
				{preset.name}
			</Swatch.Root>
		{/each}
	</div>
	<p class="text-xs text-zinc-500">Fine-tune a filter in the Adjust tab.</p>
</fieldset>
