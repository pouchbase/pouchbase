<script lang="ts">
	import * as Dialog from '../../dialog/index.js';
	import * as DropdownMenu from '../../dropdown-menu/index.js';
	import * as Icon from '../../icon/index.js';
	import { insertBlock, INSERTABLE } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import LinkDialog from './email-editor-link-dialog.svelte';

	let { disabled }: { disabled: boolean } = $props();

	const context = getEmailEditorContext();
	const dialogs = Dialog.getDialogs();

	const editor = $derived(context.editor);

	async function insertButton() {
		const result = await dialogs.open(LinkDialog, { kind: 'button', label: 'Get started' });

		if (editor && result && 'url' in result) {
			insertBlock(editor, {
				type: 'emailButton',
				attrs: { href: result.url },
				content: [{ type: 'text', text: result.label || 'Open' }]
			});
		}
	}

	async function chooseImage() {
		if (context.pickImage) {
			return context.pickImage();
		}

		const result = await dialogs.open(LinkDialog, { kind: 'image' });

		return result && 'url' in result ? { src: result.url, alt: result.label } : undefined;
	}

	async function insertImage() {
		const image = await chooseImage();

		if (editor && image) {
			insertBlock(editor, { type: 'image', attrs: image });
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger {disabled}>
		<Icon.Root icon="lucide:plus" />
		Insert
	</DropdownMenu.Trigger>

	<!-- The editor keeps the focus, so typing continues in what was inserted. -->
	<DropdownMenu.Content
		align="start"
		class="w-72"
		onCloseAutoFocus={(event) => event.preventDefault()}
	>
		<DropdownMenu.Item class="h-auto py-2" onSelect={() => void insertButton()}>
			<Icon.Root icon="lucide:rectangle-horizontal" />
			<span class="flex flex-col">
				Button
				<span class="text-xs text-zinc-500">A link that stands out</span>
			</span>
		</DropdownMenu.Item>
		<DropdownMenu.Item class="h-auto py-2" onSelect={() => void insertImage()}>
			<Icon.Root icon="lucide:image" />
			<span class="flex flex-col">
				Image
				<span class="text-xs text-zinc-500">From a URL or a variable</span>
			</span>
		</DropdownMenu.Item>
		{#each INSERTABLE as block (block.label)}
			<DropdownMenu.Item
				class="h-auto py-2"
				onSelect={() => editor && insertBlock(editor, block.content())}
			>
				<Icon.Root icon={block.icon} />
				<span class="flex flex-col">
					{block.label}
					<span class="text-xs text-zinc-500">{block.description}</span>
				</span>
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
