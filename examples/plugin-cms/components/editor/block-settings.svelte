<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Input from '@pouchbasejs/ui/inputs/input';
	import * as Textarea from '@pouchbasejs/ui/inputs/textarea';
	import * as Segmented from '@pouchbasejs/ui/segmented';

	import { BLOCK_TYPES, type Block, type HeadingLevel } from '../../lib/blocks.js';
	import { icons } from '../../lib/icons.js';

	type Props = {
		/** The selected block; `undefined` while none is. */
		block: Block | undefined;
	};

	let { block = $bindable() }: Props = $props();

	const id = $props.id();

	const info = $derived(BLOCK_TYPES.find((type) => type.type === block?.type));
</script>

{#if block && info}
	<div class="flex gap-3 border-b border-zinc-200 p-4">
		<Icon.Root src={icons[info.icon]} class="mt-0.5 size-6 text-zinc-900" />
		<div class="flex flex-col gap-1">
			<h3 class="text-sm font-semibold text-zinc-900">{info.label}</h3>
			<p class="text-[13px] text-zinc-600">{info.description}</p>
		</div>
	</div>

	<div class="flex flex-col gap-4 p-4">
		{#if block.type === 'heading'}
			<div class="flex flex-col gap-2">
				<span class="text-xs font-medium tracking-wide text-zinc-600 uppercase">Level</span>
				<Segmented.Root
					aria-label="Heading level"
					value={String(block.level)}
					onValueChange={(value) => {
						if (block?.type === 'heading') {
							block.level = Number(value) as HeadingLevel;
						}
					}}
				>
					<Segmented.Item value="2">H2</Segmented.Item>
					<Segmented.Item value="3">H3</Segmented.Item>
					<Segmented.Item value="4">H4</Segmented.Item>
				</Segmented.Root>
			</div>
		{:else if block.type === 'list'}
			<div class="flex flex-col gap-2">
				<span class="text-xs font-medium tracking-wide text-zinc-600 uppercase">Style</span>
				<Segmented.Root
					aria-label="List style"
					value={block.ordered ? 'ordered' : 'bullets'}
					onValueChange={(value) => {
						if (block?.type === 'list') {
							block.ordered = value === 'ordered';
						}
					}}
				>
					<Segmented.Item value="bullets">Bullets</Segmented.Item>
					<Segmented.Item value="ordered">Numbered</Segmented.Item>
				</Segmented.Root>
			</div>
		{:else if block.type === 'quote'}
			<div class="flex flex-col gap-2">
				<label for="{id}-cite" class="text-xs font-medium tracking-wide text-zinc-600 uppercase">
					Citation
				</label>
				<Input.Root id="{id}-cite" bind:value={block.cite} placeholder="Who said it" />
			</div>
		{:else if block.type === 'image'}
			<div class="flex flex-col gap-2">
				<label for="{id}-alt" class="text-xs font-medium tracking-wide text-zinc-600 uppercase">
					Alternative text
				</label>
				<Textarea.Root id="{id}-alt" bind:value={block.alt} class="min-h-20" />
				<p class="text-xs text-zinc-500">
					Describe the purpose of the image. Leave it empty if it is purely decorative.
				</p>
			</div>
			<div class="flex flex-col gap-2">
				<label for="{id}-src" class="text-xs font-medium tracking-wide text-zinc-600 uppercase">
					Image URL
				</label>
				<Input.Root id="{id}-src" type="url" bind:value={block.src} />
			</div>
		{:else}
			<p class="text-sm text-zinc-500">This block has no settings.</p>
		{/if}
	</div>
{:else}
	<p class="p-4 text-sm text-zinc-500">No block selected.</p>
{/if}
