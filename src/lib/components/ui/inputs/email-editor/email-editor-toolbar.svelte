<script lang="ts">
	import * as Button from '../../button/index.js';
	import * as Dialog from '../../dialog/index.js';
	import * as DropdownMenu from '../../dropdown-menu/index.js';
	import * as Icon from '../../icon/index.js';
	import * as Color from '../color/index.js';
	import * as Select from '../select/index.js';
	import { getEmailEditorContext } from './email-editor-context';
	import LinkDialog from './email-editor-link-dialog.svelte';
	import ToolbarInsert from './email-editor-toolbar-insert.svelte';
	import type { Tool } from './email-editor-toolbar-tools';
	import { BLOCK_STYLES, FONT_SIZES, formattingTools } from './email-editor-toolbar-tools';

	let { class: className }: { class?: string } = $props();

	const context = getEmailEditorContext();
	const dialogs = Dialog.getDialogs();

	const editor = $derived(context.editor);
	const disabled = $derived(!editor || context.disabled);

	function active(name: string | Record<string, unknown>, attributes?: Record<string, unknown>) {
		void context.version;

		if (!editor) {
			return false;
		}

		return typeof name === 'string' ? editor.isActive(name, attributes) : editor.isActive(name);
	}

	const blockStyle = $derived.by(() => {
		void context.version;

		for (const level of [1, 2, 3]) {
			if (active('heading', { level })) {
				return `h${level}`;
			}
		}

		return 'paragraph';
	});

	function setBlockStyle(value: string) {
		const chain = editor?.chain().focus();

		if (value === 'paragraph') {
			chain?.setParagraph().run();
		} else {
			chain?.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
		}
	}

	const fontSize = $derived.by(() => {
		void context.version;

		return (editor?.getAttributes('textStyle').fontSize as string | undefined) ?? 'default';
	});

	function setFontSize(value: string) {
		if (value === 'default') {
			editor?.chain().focus().unsetFontSize().run();
		} else {
			editor?.chain().focus().setFontSize(value).run();
		}
	}

	const textColor = $derived.by(() => {
		void context.version;

		const color = editor?.getAttributes('textStyle').color as string | undefined;

		// Colors parsed from HTML can come back as `rgb(…)`; the picker only takes hex.
		return color && /^#[0-9a-f]{6}$/i.test(color) ? color : context.mailStyle.textColor;
	});

	async function editLink() {
		if (!editor) {
			return;
		}

		const href = (editor.getAttributes('link').href as string | undefined) ?? '';
		const result = await dialogs.open(LinkDialog, { kind: 'link', url: href });

		if (!result) {
			editor.commands.focus();
		} else if ('remove' in result) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
		} else if (editor.state.selection.empty && !href) {
			editor
				.chain()
				.focus()
				.insertContent({
					type: 'text',
					text: result.url,
					marks: [{ type: 'link', attrs: { href: result.url } }]
				})
				.run();
		} else {
			editor.chain().focus().extendMarkRange('link').setLink({ href: result.url }).run();
		}
	}

	const { marks, alignments, lists } = formattingTools(active, editLink);
</script>

{#snippet tools(list: Tool[])}
	{#each list as tool (tool.label)}
		<Button.Root
			type="button"
			variant="ghost"
			size="icon"
			aria-label={tool.label}
			title={tool.label}
			aria-pressed={tool.active ? tool.active() : undefined}
			{disabled}
			class="aria-pressed:bg-zinc-200 aria-pressed:text-zinc-900"
			onclick={() => editor && tool.run(editor)}
		>
			<Icon.Root icon={tool.icon} />
		</Button.Root>
	{/each}
{/snippet}

{#snippet separator()}
	<span class="mx-1 h-5 w-px bg-zinc-200" aria-hidden="true"></span>
{/snippet}

<div
	role="toolbar"
	aria-label="Formatting"
	class={['flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-white p-1.5', className]}
>
	<ToolbarInsert {disabled} />

	{@render separator()}

	<Button.Root
		type="button"
		variant="ghost"
		size="icon"
		aria-label="Undo"
		title="Undo"
		{disabled}
		onclick={() => editor?.chain().focus().undo().run()}
	>
		<Icon.Root icon="lucide:undo-2" />
	</Button.Root>
	<Button.Root
		type="button"
		variant="ghost"
		size="icon"
		aria-label="Redo"
		title="Redo"
		{disabled}
		onclick={() => editor?.chain().focus().redo().run()}
	>
		<Icon.Root icon="lucide:redo-2" />
	</Button.Root>

	{@render separator()}

	<div class="grid w-64 grid-cols-2 gap-1">
		<Select.Root
			items={BLOCK_STYLES}
			value={blockStyle}
			{disabled}
			aria-label="Text style"
			onValueChange={setBlockStyle}
		/>
		<Select.Root
			items={FONT_SIZES}
			value={fontSize}
			{disabled}
			aria-label="Text size"
			onValueChange={setFontSize}
		/>
	</div>

	{@render separator()}
	{@render tools(marks)}

	<Color.Root
		value={textColor}
		aria-label="Text color"
		{disabled}
		class="w-28"
		onValueChange={(color) => editor?.chain().focus().setColor(color).run()}
	/>
	<Button.Root
		type="button"
		variant="ghost"
		size="icon"
		aria-label="Default text color"
		title="Default text color"
		{disabled}
		onclick={() => editor?.chain().focus().unsetColor().run()}
	>
		<Icon.Root icon="lucide:eraser" />
	</Button.Root>

	{@render separator()}
	{@render tools(alignments)}
	{@render separator()}
	{@render tools(lists)}

	<div class="ml-auto">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger variant="ghost" {disabled}>
				<Icon.Root icon="lucide:braces" />
				Variable
			</DropdownMenu.Trigger>

			<DropdownMenu.Content onCloseAutoFocus={(event) => event.preventDefault()}>
				{#each context.variables as name (name)}
					<DropdownMenu.Item
						onSelect={() => editor?.chain().focus().insertContent(`{{${name}}}`).run()}
					>
						<span class="font-mono text-xs">{`{{${name}}}`}</span>
					</DropdownMenu.Item>
				{:else}
					<DropdownMenu.Item disabled>Type {'{{name}}'} to add a variable</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>
