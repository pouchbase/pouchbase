<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Checkbox from '#lib/components/ui/inputs/checkbox/index.js';
	import * as Input from '#lib/components/ui/inputs/input/index.js';
	import { getImageEditorContext } from './image-editor-context.js';
	import { MAX_DIMENSION } from './image-editor-state.svelte.js';

	const ASPECTS: { key: string; label: string }[] = [
		{ key: 'free', label: 'Free' },
		{ key: 'original', label: 'Original' },
		{ key: '1:1', label: '1:1' },
		{ key: '4:3', label: '4:3' },
		{ key: '3:2', label: '3:2' },
		{ key: '16:9', label: '16:9' },
		{ key: '4:5', label: '4:5' },
		{ key: '9:16', label: '9:16' }
	];

	const SCALES = [25, 50, 75];

	const editor = getImageEditorContext();
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 font-medium text-zinc-900">Aspect ratio</legend>
	<div class="grid grid-cols-4 gap-1">
		{#each ASPECTS as option (option.key)}
			<Button.Root
				variant={editor.edit.aspect === option.key ? 'primary' : 'secondary'}
				class="px-0 text-xs"
				aria-pressed={editor.edit.aspect === option.key}
				onclick={() => editor.chooseAspect(option.key)}
			>
				{option.label}
			</Button.Root>
		{/each}
	</div>
	<p class="text-xs text-zinc-500">
		Selection {editor.cropWidth} × {editor.cropHeight} px · drag the corners or use the arrow keys
	</p>
</fieldset>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 font-medium text-zinc-900">Rotate & flip</legend>
	<div class="grid grid-cols-4 gap-1">
		<Button.Root
			variant="secondary"
			size="icon"
			class="w-full"
			aria-label="Rotate left"
			title="Rotate left"
			onclick={() => editor.rotate(-90)}
		>
			<Icon.Root icon="lucide:rotate-ccw" />
		</Button.Root>
		<Button.Root
			variant="secondary"
			size="icon"
			class="w-full"
			aria-label="Rotate right"
			title="Rotate right"
			onclick={() => editor.rotate(90)}
		>
			<Icon.Root icon="lucide:rotate-cw" />
		</Button.Root>
		<Button.Root
			variant={editor.edit.flipHorizontal ? 'primary' : 'secondary'}
			size="icon"
			class="w-full"
			aria-label="Flip horizontally"
			title="Flip horizontally"
			aria-pressed={editor.edit.flipHorizontal}
			onclick={() => editor.flip('flipHorizontal')}
		>
			<Icon.Root icon="lucide:flip-horizontal-2" />
		</Button.Root>
		<Button.Root
			variant={editor.edit.flipVertical ? 'primary' : 'secondary'}
			size="icon"
			class="w-full"
			aria-label="Flip vertically"
			title="Flip vertically"
			aria-pressed={editor.edit.flipVertical}
			onclick={() => editor.flip('flipVertical')}
		>
			<Icon.Root icon="lucide:flip-vertical-2" />
		</Button.Root>
	</div>
</fieldset>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 font-medium text-zinc-900">Resize</legend>
	<label class="flex items-center gap-2">
		<Checkbox.Root
			checked={editor.edit.resize.enabled}
			onchange={(event) => editor.toggleResize(event.currentTarget.checked)}
		/>
		Resize the result
	</label>

	{#if editor.edit.resize.enabled}
		<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
			<Input.Root
				type="number"
				min="1"
				max={MAX_DIMENSION}
				aria-label="Width in pixels"
				aria-invalid={editor.outputWidth > MAX_DIMENSION || undefined}
				value={editor.edit.resize.width}
				oninput={(event) =>
					(editor.edit.resize.width = Math.max(1, Number(event.currentTarget.value) || 1))}
				onchange={editor.commit}
			/>
			<span class="text-zinc-400">×</span>
			<Input.Root
				type="number"
				min="1"
				max={MAX_DIMENSION}
				aria-label="Height in pixels"
				aria-invalid={editor.outputHeight > MAX_DIMENSION || undefined}
				value={editor.resizeHeight}
				oninput={(event) => editor.setResizeHeight(Number(event.currentTarget.value) || 1)}
				onchange={editor.commit}
			/>
		</div>
	{/if}

	<div class="grid grid-cols-3 gap-1">
		{#each SCALES as percent (percent)}
			<Button.Root variant="secondary" class="px-0 text-xs" onclick={() => editor.scaleTo(percent)}>
				{percent}%
			</Button.Root>
		{/each}
	</div>

	{#if editor.tooLarge}
		<p class="text-xs text-red-600">
			The result can be at most {MAX_DIMENSION} px wide and high.
		</p>
	{/if}
</fieldset>
