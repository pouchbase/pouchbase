<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Slider from '#lib/components/ui/inputs/slider/index.js';
	import {
		ADJUSTMENT_RANGES,
		isNeutral,
		NEUTRAL_ADJUSTMENTS,
		type Adjustments
	} from '#lib/files/image-edits.js';
	import { getImageEditorContext } from './image-editor-context.js';

	const CONTROLS: { key: keyof Adjustments; label: string; unit?: string }[] = [
		{ key: 'brightness', label: 'Brightness' },
		{ key: 'contrast', label: 'Contrast' },
		{ key: 'saturation', label: 'Saturation' },
		{ key: 'hue', label: 'Hue', unit: '°' },
		{ key: 'grayscale', label: 'Grayscale' },
		{ key: 'sepia', label: 'Sepia' }
	];

	const editor = getImageEditorContext();
	const uid = $props.id();
</script>

<fieldset class="flex flex-col gap-1">
	<legend class="mb-2 font-medium text-zinc-900">Adjust</legend>

	{#each CONTROLS as control (control.key)}
		{@const value = editor.edit.adjustments[control.key]}
		{@const range = ADJUSTMENT_RANGES[control.key]}

		<div class="flex items-center justify-between gap-2 text-xs text-zinc-500">
			<span id="{uid}-{control.key}">{control.label}</span>
			<span class="flex items-center gap-1">
				<span class="tabular-nums">{value}{control.unit ?? ''}</span>
				<Button.Root
					variant="ghost"
					size="icon-sm"
					class={[value === NEUTRAL_ADJUSTMENTS[control.key] && 'invisible']}
					aria-label="Reset {control.label.toLowerCase()}"
					onclick={() => editor.setAdjustment(control.key, NEUTRAL_ADJUSTMENTS[control.key])}
				>
					<Icon.Root icon="lucide:rotate-ccw" />
				</Button.Root>
			</span>
		</div>
		<Slider.Root
			bind:value={editor.edit.adjustments[control.key]}
			min={range.min}
			max={range.max}
			aria-labelledby="{uid}-{control.key}"
			onValueCommit={editor.commit}
		/>
	{/each}

	<Button.Root
		variant="ghost"
		class="mt-2 self-start"
		disabled={isNeutral(editor.edit.adjustments)}
		onclick={() => editor.choosePreset(NEUTRAL_ADJUSTMENTS)}
	>
		<Icon.Root icon="lucide:rotate-ccw" />
		Reset adjustments
	</Button.Root>
</fieldset>
