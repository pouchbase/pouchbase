<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Input from '@pouchbasejs/ui/inputs/input';

	import { BLOCK_TYPES, isTextBlock, type Block, type BlockType } from '../../lib/blocks.js';
	import { icons } from '../../lib/icons.js';
	import Popover from '../popover.svelte';
	import { getEditorContext } from './editor-context.js';
	import ToolbarButton from './toolbar-button.svelte';

	type Props = {
		block: Block;
		/** The block's editable element, for formatting its selected text. */
		element: HTMLElement | null;
	};

	let { block = $bindable(), element }: Props = $props();

	const editor = getEditorContext();

	const index = $derived(editor.blocks.findIndex((item) => item.id === block.id));
	const info = $derived(BLOCK_TYPES.find((type) => type.type === block.type)!);

	/** The types a block can become: those that keep its text. */
	const TRANSFORMS: BlockType[] = ['paragraph', 'heading', 'list', 'quote', 'code'];

	let typesOpen = $state(false);
	let typesButton = $state<HTMLElement | null>(null);

	let linkOpen = $state(false);
	let linkButton = $state<HTMLElement | null>(null);
	let linkUrl = $state('');
	let savedRange: Range | null = null;

	// Whether the selected text is bold or italic, for the pressed state of the buttons.
	let bold = $state(false);
	let italic = $state(false);

	function updateFormats() {
		const selection = getSelection();
		const inside = !!element && !!selection?.anchorNode && element.contains(selection.anchorNode);

		bold = inside && document.queryCommandState('bold');
		italic = inside && document.queryCommandState('italic');
	}

	function format(command: 'bold' | 'italic') {
		// `execCommand` is deprecated but still the one way to format a selection in every browser;
		// it fires `input`, so the block's HTML follows.
		document.execCommand(command);
		updateFormats();
	}

	function openLink() {
		const selection = getSelection();
		const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

		if (!element || !range || !element.contains(range.startContainer)) {
			return;
		}

		savedRange = range.cloneRange();
		linkUrl = '';
		linkOpen = true;
	}

	function applyLink(event: SubmitEvent) {
		event.preventDefault();

		const url = linkUrl.trim();

		linkOpen = false;

		if (!element || !savedRange) {
			return;
		}

		element.focus();
		getSelection()?.removeAllRanges();
		getSelection()?.addRange(savedRange);

		if (!url) {
			document.execCommand('unlink');
		} else if (savedRange.collapsed) {
			// Without selected text the link gets its URL as text.
			document.execCommand(
				'insertHTML',
				false,
				`<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`
			);
		} else {
			document.execCommand(
				'createLink',
				false,
				/^[a-z]+:|^\/|^#/i.test(url) ? url : `https://${url}`
			);
		}
	}

	// Clicks on the toolbar leave the focus in the block, except in the link's URL field.
	function keepFocus(event: MouseEvent) {
		if (!(event.target as HTMLElement).closest('input')) {
			event.preventDefault();
		}
	}

	function setLevel(level: 2 | 3 | 4) {
		if (block.type === 'heading') {
			block.level = level;
		}
	}

	function setOrdered(ordered: boolean) {
		if (block.type === 'list') {
			block.ordered = ordered;
		}
	}
</script>

<svelte:document onselectionchange={updateFormats} />

<div
	role="toolbar"
	aria-label="{info.label} block tools"
	tabindex="-1"
	onmousedown={keepFocus}
	class="flex h-control items-stretch divide-x divide-zinc-900 overflow-visible rounded-md border border-zinc-900 bg-white shadow-sm [&>*]:shrink-0"
>
	<div class="relative">
		<Button.Root
			bind:ref={typesButton}
			variant="ghost"
			class="rounded-none rounded-l-md px-2"
			aria-label="Change block type, {info.label}"
			title="Change block type"
			aria-expanded={typesOpen}
			disabled={!TRANSFORMS.includes(block.type)}
			onclick={() => (typesOpen = !typesOpen)}
		>
			<Icon.Root src={icons[info.icon]} />
			<Icon.Root src={icons.chevronDown} class="size-3! text-zinc-500" />
		</Button.Root>

		<Popover bind:open={typesOpen} anchor={typesButton} label="Transform to" class="w-52">
			<p class="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
				Transform to
			</p>
			{#each BLOCK_TYPES.filter((type) => TRANSFORMS.includes(type.type)) as type (type.type)}
				<button
					type="button"
					class="flex h-control w-full items-center gap-2.5 rounded-md px-2 text-sm text-zinc-800 hover:bg-zinc-100 aria-current:font-semibold aria-current:text-blue-700"
					aria-current={type.type === block.type || undefined}
					onclick={() => {
						typesOpen = false;
						editor.transform(block.id, type.type);
					}}
				>
					<Icon.Root src={icons[type.icon]} class="size-4" />
					{type.label}
				</button>
			{/each}
		</Popover>
	</div>

	{#if block.type === 'heading'}
		<div class="flex">
			<ToolbarButton
				icon="heading2"
				label="Heading 2"
				pressed={block.level === 2}
				onclick={() => setLevel(2)}
			/>
			<ToolbarButton
				icon="heading3"
				label="Heading 3"
				pressed={block.level === 3}
				onclick={() => setLevel(3)}
			/>
			<ToolbarButton
				icon="heading4"
				label="Heading 4"
				pressed={block.level === 4}
				onclick={() => setLevel(4)}
			/>
		</div>
	{:else if block.type === 'list'}
		<div class="flex">
			<ToolbarButton
				icon="list"
				label="Bulleted list"
				pressed={!block.ordered}
				onclick={() => setOrdered(false)}
			/>
			<ToolbarButton
				icon="listOrdered"
				label="Numbered list"
				pressed={block.ordered}
				onclick={() => setOrdered(true)}
			/>
		</div>
	{:else if block.type === 'image' && block.src}
		<Button.Root
			variant="ghost"
			class="rounded-none px-3"
			onclick={() => {
				if (block.type === 'image') {
					block.src = '';
				}
			}}
		>
			Replace
		</Button.Root>
	{/if}

	{#if isTextBlock(block)}
		<div class="relative flex">
			<ToolbarButton icon="bold" label="Bold" pressed={bold} onclick={() => format('bold')} />
			<ToolbarButton
				icon="italic"
				label="Italic"
				pressed={italic}
				onclick={() => format('italic')}
			/>
			<ToolbarButton bind:ref={linkButton} icon="link" label="Link" onclick={openLink} />

			<Popover bind:open={linkOpen} anchor={linkButton} label="Link" class="w-72">
				<form class="flex gap-1.5" onsubmit={applyLink}>
					<Input.Root
						type="text"
						bind:value={linkUrl}
						placeholder="Search or type URL"
						aria-label="Link URL"
						class="min-w-0 flex-1"
						{@attach (input) => input.focus()}
					/>
					<Button.Root type="submit" size="icon" aria-label="Apply link">
						<Icon.Root src={icons.check} />
					</Button.Root>
				</form>
				<p class="px-1 pt-1.5 text-xs text-zinc-500">Leave it empty to remove the link.</p>
			</Popover>
		</div>
	{/if}

	<div class="flex">
		<ToolbarButton
			icon="arrowUp"
			label="Move up"
			disabled={index <= 0}
			onclick={() => editor.move(block.id, -1)}
		/>
		<ToolbarButton
			icon="arrowDown"
			label="Move down"
			disabled={index === editor.blocks.length - 1}
			onclick={() => editor.move(block.id, 1)}
		/>
	</div>

	<div class="flex overflow-hidden rounded-r-md">
		<ToolbarButton icon="trash2" label="Remove block" onclick={() => editor.remove(block.id)} />
	</div>
</div>
