<script module lang="ts">
	import type { z } from 'zod';
	import type { imageEditsSchema } from '#lib/schemas/collection-settings.js';

	/** What `save` gets: the file and the edits to apply to it. */
	export type ImageEditRequest = z.input<typeof imageEditsSchema>;

	export type Props = {
		fileId: string;
		/** Current name and type of the file, e.g. to name a converted copy. */
		name: string;
		mimeType: string;
		/** The loaded original. */
		image: HTMLImageElement;
		/** Applies the edits on the server, e.g. the `editImage` remote function. */
		save: (request: ImageEditRequest) => Promise<unknown>;
		/** Called after the edited image has been saved. */
		onSaved: () => void;
	};
</script>

<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Segmented from '#lib/components/ui/segmented/index.js';
	import { toast } from '#lib/components/ui/toast/index.js';
	import { isNeutral } from '#lib/files/image-edits.js';
	import { setImageEditorContext } from './image-editor-context.js';
	import ImageEditorAdjust from './image-editor-adjust.svelte';
	import ImageEditorCrop from './image-editor-crop.svelte';
	import ImageEditorExport from './image-editor-export.svelte';
	import ImageEditorFilters from './image-editor-filters.svelte';
	import ImageEditorPreview from './image-editor-preview.svelte';
	import ImageEditorToolbar from './image-editor-toolbar.svelte';
	import { ImageEditorState, type Tab } from './image-editor-state.svelte.js';

	let { fileId, name, mimeType, image, save, onSaved }: Props = $props();

	const editor = new ImageEditorState({
		get image() {
			return image;
		},
		get name() {
			return name;
		},
		get mimeType() {
			return mimeType;
		}
	});

	setImageEditorContext(editor);

	let failure = $state('');

	async function apply() {
		failure = '';

		const { edit } = editor;

		try {
			await save({
				id: fileId,
				edits: {
					rotate: edit.rotation,
					flipHorizontal: edit.flipHorizontal,
					flipVertical: edit.flipVertical,
					crop: editor.cropped ? $state.snapshot(edit.area) : undefined,
					resize: edit.resize.enabled
						? { width: edit.resize.width, height: editor.resizeHeight }
						: undefined,
					adjustments: isNeutral(edit.adjustments) ? undefined : $state.snapshot(edit.adjustments),
					output: { format: edit.format, quality: edit.quality }
				}
			});
			await refreshAll();
			toast.success('Image saved');
			onSaved();
		} catch (error) {
			failure =
				(error as { body?: { message?: string } })?.body?.message ??
				'The image could not be saved.';
		}
	}
</script>

<svelte:window onkeydown={editor.handleKeydown} />

{#if failure}
	<div
		role="alert"
		class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
	>
		{failure}
	</div>
{/if}

<div class="grid gap-6 md:grid-cols-[1fr_18rem]">
	<div class="flex min-w-0 flex-col gap-2">
		<ImageEditorToolbar />
		<ImageEditorPreview />
	</div>

	<div class="flex flex-col gap-5 text-sm">
		<Segmented.Root
			value={editor.tab}
			onValueChange={(value) => (editor.tab = value as Tab)}
			aria-label="Editing tools"
			class="w-full"
		>
			<Segmented.Item value="crop" class="flex-1">Crop</Segmented.Item>
			<Segmented.Item value="adjust" class="flex-1">Adjust</Segmented.Item>
			<Segmented.Item value="filters" class="flex-1">Filters</Segmented.Item>
			<Segmented.Item value="export" class="flex-1">Export</Segmented.Item>
		</Segmented.Root>

		{#if editor.tab === 'crop'}
			<ImageEditorCrop />
		{:else if editor.tab === 'adjust'}
			<ImageEditorAdjust />
		{:else if editor.tab === 'filters'}
			<ImageEditorFilters />
		{:else}
			<ImageEditorExport />
		{/if}
	</div>
</div>

<Dialog.Footer class="sm:justify-between">
	<Button.Root variant="ghost" disabled={editor.pristine} onclick={editor.reset}>
		<Icon.Root icon="lucide:list-restart" />
		Reset all
	</Button.Root>

	<div class="flex flex-col-reverse gap-2 sm:flex-row">
		<Dialog.Close>Cancel</Dialog.Close>
		<Button.Root disabled={editor.pristine || editor.tooLarge} onclick={apply}>Apply</Button.Root>
	</div>
</Dialog.Footer>
