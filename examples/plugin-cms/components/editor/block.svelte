<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Input from '@pouchbasejs/ui/inputs/input';

	import { autosize } from '../../lib/autosize.js';
	import {
		createBlock,
		findBlockTypes,
		isTextBlock,
		textOf,
		type Block,
		type BlockType
	} from '../../lib/blocks.js';
	import { caretAtEnd, caretAtStart, splitAtCaret } from '../../lib/caret.js';
	import { icons } from '../../lib/icons.js';
	import Popover from '../popover.svelte';
	import BlockInserter from './block-inserter.svelte';
	import BlockToolbar from './block-toolbar.svelte';
	import { getEditorContext } from './editor-context.js';
	import RichText from './rich-text.svelte';
	import SlashMenu from './slash-menu.svelte';

	type Props = {
		block: Block;
	};

	let { block = $bindable() }: Props = $props();

	const editor = getEditorContext();

	const selected = $derived(editor.selected === block.id);
	const empty = $derived(isTextBlock(block) && textOf(block.html).trim() === '');

	let element = $state<HTMLElement | null>(null);

	// The toolbar hides while typing, as in the WordPress editor, and comes back when the mouse moves.
	let typing = $state(false);

	// The `/` menu: open while a paragraph is only a slash and a word, until Escape.
	const slashQuery = $derived(
		block.type === 'paragraph'
			? (/^\/([\w-]*)$/.exec(textOf(block.html).trim())?.[1] ?? null)
			: null
	);
	const slashTypes = $derived(slashQuery === null ? [] : findBlockTypes(slashQuery));
	// Back to the first match whenever the query changes.
	let slashActive = $derived.by(() => {
		void slashQuery;
		return 0;
	});
	let slashDismissed = $state<string | null>(null);
	const slashOpen = $derived(
		slashQuery !== null && block.type === 'paragraph' && slashDismissed !== block.html
	);

	let inserterOpen = $state(false);
	let inserterButton = $state<HTMLElement | null>(null);

	let imageUrl = $state('');

	const HEADING_SIZES = { 2: 'text-3xl', 3: 'text-2xl', 4: 'text-xl' } as const;

	/** Markdown shortcuts at the start of a paragraph, as in the WordPress editor. */
	function applyShortcut(html: string) {
		if (block.type !== 'paragraph') {
			return;
		}

		const text = textOf(html).replace(/\u00a0/g, ' ');

		if (text === '```') {
			editor.replace(block.id, createBlock('code'));
			return;
		}

		if (text === '---') {
			const separator = createBlock('separator');

			editor.replace(block.id, separator);
			editor.insert(createBlock('paragraph'), separator.id);
			return;
		}

		const match = /^(#{1,4}|[-*]|1\.|>)(?: |&nbsp;|\u00a0)/.exec(html);

		if (!match) {
			return;
		}

		const rest = html.slice(match[0].length);
		const marker = match[1];
		let next: Block;

		if (marker.startsWith('#')) {
			next = { ...createBlock('heading', rest), level: Math.max(2, marker.length) } as Block;
		} else if (marker === '>') {
			next = createBlock('quote', rest);
		} else {
			next = { ...createBlock('list', rest), ordered: marker === '1.' } as Block;
		}

		editor.replace(block.id, next);
	}

	function pick(type: BlockType) {
		inserterOpen = false;
		editor.replace(block.id, createBlock(type));
	}

	function handleSlashKeys(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			slashActive =
				(slashActive + (event.key === 'ArrowDown' ? 1 : -1) + slashTypes.length) %
				Math.max(1, slashTypes.length);
			return true;
		}

		if (event.key === 'Enter' && slashTypes[slashActive]) {
			event.preventDefault();
			pick(slashTypes[slashActive].type);
			return true;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			slashDismissed = block.type === 'paragraph' ? block.html : null;
			return true;
		}

		return false;
	}

	/** Enter in a list adds an item; in an empty last item it ends the list with a paragraph. */
	function handleListEnter(event: KeyboardEvent) {
		const anchor = getSelection()?.anchorNode ?? null;
		const li = (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest('li');

		if (!element || !li || !element.contains(li) || li.textContent?.trim()) {
			return;
		}

		event.preventDefault();
		li.remove();

		const html = element.innerHTML.trim();

		if (!element.querySelector('li')) {
			editor.replace(block.id, createBlock('paragraph'));
			return;
		}

		if (block.type === 'list') {
			block.html = html;
		}

		editor.insert(createBlock('paragraph'), block.id);
	}

	function handleTextKeydown(event: KeyboardEvent) {
		if (event.isComposing || !element) {
			return;
		}

		if (slashOpen && handleSlashKeys(event)) {
			return;
		}

		if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
			typing = true;
		}

		if (event.key === 'Enter' && !event.shiftKey) {
			if (block.type === 'list') {
				handleListEnter(event);
				return;
			}

			event.preventDefault();

			const split = splitAtCaret(element);

			if (!split) {
				return;
			}

			if (isTextBlock(block)) {
				block.html = split.before;
			}

			editor.insert(createBlock('paragraph', split.after), block.id);
			return;
		}

		if (event.key === 'Backspace' && caretAtStart(element)) {
			if (block.type === 'paragraph') {
				if (empty && editor.blocks.length > 1) {
					event.preventDefault();
					editor.remove(block.id);
				} else if (editor.mergeWithPrevious(block.id)) {
					event.preventDefault();
				}
			} else if (block.type !== 'list' || empty) {
				// A heading, quote or list loses its type first, like in the WordPress editor.
				event.preventDefault();
				editor.transform(block.id, 'paragraph');
			}

			return;
		}

		if (event.key === 'ArrowUp' && caretAtStart(element) && editor.focusSibling(block.id, -1)) {
			event.preventDefault();
		}

		if (event.key === 'ArrowDown' && caretAtEnd(element) && editor.focusSibling(block.id, 1)) {
			event.preventDefault();
		}
	}

	/** Keys for the blocks that aren't text: code, HTML, image and separator. */
	function handleOtherKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const field =
			target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement ? target : null;
		const value = field?.value ?? '';
		const atStart = !field || (field.selectionStart === 0 && field.selectionEnd === 0);
		const atEnd = !field || field.selectionStart === value.length;

		if (!field && (event.key === 'Backspace' || event.key === 'Delete')) {
			event.preventDefault();
			editor.remove(block.id);
		} else if (
			event.key === 'Backspace' &&
			field &&
			value === '' &&
			target.dataset.editable !== undefined
		) {
			event.preventDefault();
			editor.remove(block.id);
		} else if (
			event.key === 'Enter' &&
			(!field || field instanceof HTMLInputElement) &&
			block.type !== 'image'
		) {
			event.preventDefault();
			editor.insert(createBlock('paragraph'), block.id);
		} else if (event.key === 'ArrowUp' && atStart && editor.focusSibling(block.id, -1)) {
			event.preventDefault();
		} else if (event.key === 'ArrowDown' && atEnd && editor.focusSibling(block.id, 1)) {
			event.preventDefault();
		}
	}

	function insertImage(event: SubmitEvent) {
		event.preventDefault();

		if (block.type === 'image' && imageUrl.trim()) {
			block.src = imageUrl.trim();
			imageUrl = '';
		}
	}
</script>

<svelte:window onmousemove={() => (typing = false)} />

<!-- Keys and focus come from the block's own controls (its text, fields or image) and bubble up here. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	data-block={block.id}
	class={[
		'group/block relative rounded-sm',
		selected &&
			!isTextBlock(block) &&
			'outline-2 outline-offset-4 outline-blue-600 [&_[data-editable]]:outline-none'
	]}
	onfocusin={() => editor.select(block.id)}
	onkeydown={isTextBlock(block) ? handleTextKeydown : handleOtherKeydown}
	role="group"
	aria-label="Block: {block.type}"
>
	{#if selected && !typing && !slashOpen}
		<div class="absolute bottom-full left-0 z-30 mb-3">
			<BlockToolbar bind:block {element} />
		</div>
	{/if}

	{#if block.type === 'paragraph'}
		<RichText
			tag="p"
			bind:html={block.html}
			bind:element
			oninput={applyShortcut}
			placeholder={selected || editor.blocks.length === 1 ? 'Type / to choose a block' : ''}
			class="text-[1.1875rem]/[1.7] text-zinc-800"
		/>
	{:else if block.type === 'heading'}
		<RichText
			tag="h{block.level}"
			bind:html={block.html}
			bind:element
			placeholder="Heading"
			class={['font-serif leading-tight font-semibold text-zinc-900', HEADING_SIZES[block.level]]}
		/>
	{:else if block.type === 'list'}
		<RichText
			tag={block.ordered ? 'ol' : 'ul'}
			bind:html={block.html}
			bind:element
			placeholder="List"
			class={[
				'pl-7 text-[1.1875rem]/[1.7] text-zinc-800 data-empty:before:left-7 [&>li]:my-1',
				block.ordered ? 'list-decimal' : 'list-disc'
			]}
		/>
	{:else if block.type === 'quote'}
		<blockquote class="flex flex-col gap-2 border-l-4 border-zinc-900 py-1 pl-6">
			<RichText
				tag="p"
				bind:html={block.html}
				bind:element
				placeholder="Add quote"
				class="font-serif text-2xl/snug text-zinc-900 italic"
			/>
			<input
				type="text"
				bind:value={block.cite}
				placeholder="Add citation"
				aria-label="Citation"
				class="border-none bg-transparent p-0 text-sm text-zinc-500 outline-none placeholder:text-zinc-400 focus:ring-0"
			/>
		</blockquote>
	{:else if block.type === 'code'}
		<textarea
			bind:value={block.text}
			{@attach autosize(block.text)}
			data-editable=""
			rows="1"
			spellcheck="false"
			placeholder="Write code…"
			aria-label="Code"
			class="block w-full resize-none overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm/6 text-zinc-800 outline-none placeholder:text-zinc-400"
		></textarea>
	{:else if block.type === 'html'}
		<div class="overflow-hidden rounded-md border border-zinc-200">
			<div
				class="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600"
			>
				<Icon.Root src={icons.codeXml} class="size-3.5" />
				HTML
			</div>
			<textarea
				bind:value={block.html}
				{@attach autosize(block.html)}
				data-editable=""
				rows="2"
				spellcheck="false"
				placeholder="Write HTML…"
				aria-label="Custom HTML"
				class="block w-full resize-none overflow-hidden border-none bg-white p-3 font-mono text-sm/6 text-zinc-800 outline-none placeholder:text-zinc-400 focus:ring-0"
			></textarea>
		</div>
	{:else if block.type === 'image'}
		{#if block.src}
			<figure class="flex flex-col items-center gap-2">
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<img
					src={block.src}
					alt={block.alt}
					tabindex="0"
					data-editable=""
					class="max-h-[32rem] max-w-full rounded-sm outline-none"
				/>
				<input
					type="text"
					bind:value={block.caption}
					placeholder="Add caption"
					aria-label="Image caption"
					class="w-full border-none bg-transparent p-0 text-center text-sm text-zinc-500 outline-none placeholder:text-zinc-400 focus:ring-0"
				/>
			</figure>
		{:else}
			<div class="flex flex-col gap-3 rounded-md border border-zinc-900 bg-white p-5">
				<div class="flex items-center gap-2 text-sm font-semibold text-zinc-900">
					<Icon.Root src={icons.image} class="size-5" />
					Image
				</div>
				<p class="text-sm text-zinc-600">
					Paste the address of an image, e.g. from your file storage or another site.
				</p>
				<form class="flex gap-2" onsubmit={insertImage}>
					<Input.Root
						type="url"
						bind:value={imageUrl}
						data-editable=""
						placeholder="https://example.com/photo.jpg"
						aria-label="Image URL"
						class="min-w-0 flex-1"
					/>
					<Button.Root type="submit" disabled={!imageUrl.trim()}>Insert</Button.Root>
				</form>
			</div>
		{/if}
	{:else if block.type === 'separator'}
		<!-- A separator is selected like any block, to move or remove it. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			tabindex="0"
			role="separator"
			aria-label="Separator"
			data-editable=""
			class="py-3 outline-none"
		>
			<hr class="mx-auto w-24 border-t-2 border-zinc-300" />
		</div>
	{/if}

	{#if slashOpen}
		<SlashMenu types={slashTypes} active={slashActive} onpick={pick} />
	{/if}

	<!-- The inserter of an empty paragraph, at its right, as in the WordPress editor. -->
	{#if block.type === 'paragraph' && empty && selected && !slashOpen}
		<div class="absolute top-1/2 right-0 -translate-y-1/2">
			<Button.Root
				bind:ref={inserterButton}
				variant="ghost"
				size="icon"
				aria-label="Add block"
				title="Add block"
				aria-expanded={inserterOpen}
				onmousedown={(event: MouseEvent) => event.preventDefault()}
				onclick={() => (inserterOpen = !inserterOpen)}
				class="bg-zinc-900 text-white hover:bg-zinc-700 hover:text-white"
			>
				<Icon.Root src={icons.plus} />
			</Button.Root>

			<Popover bind:open={inserterOpen} anchor={inserterButton} align="end" label="Add block">
				<BlockInserter onpick={pick} />
			</Popover>
		</div>
	{/if}
</div>
