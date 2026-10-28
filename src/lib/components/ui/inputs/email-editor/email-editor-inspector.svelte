<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Inspector from '../../inspector/index.js';
	import type { SelectedBlock } from './email-editor-blocks';
	import { BLOCK_LABELS, selectedBlocks, TEXT_BLOCK_TYPES } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import InspectorActions from './email-editor-inspector-actions.svelte';
	import InspectorButton from './email-editor-inspector-button.svelte';
	import InspectorColumn from './email-editor-inspector-column.svelte';
	import InspectorColumns from './email-editor-inspector-columns.svelte';
	import InspectorDivider from './email-editor-inspector-divider.svelte';
	import InspectorImage from './email-editor-inspector-image.svelte';
	import InspectorSection from './email-editor-inspector-section.svelte';
	import InspectorSpacer from './email-editor-inspector-spacer.svelte';
	import InspectorSpacing from './email-editor-inspector-spacing.svelte';

	type Props = {
		/** Shown when no block with settings is selected, e.g. the settings of the whole email. */
		fallback?: Snippet;
		class?: string;
	};

	let { fallback, class: className }: Props = $props();

	const context = getEmailEditorContext();

	const blocks = $derived.by(() => {
		void context.version;

		return context.editor ? selectedBlocks(context.editor) : [];
	});

	const ICONS: Record<SelectedBlock['type'], string> = {
		emailButton: 'lucide:rectangle-horizontal',
		image: 'lucide:image',
		emailSpacer: 'lucide:move-vertical',
		horizontalRule: 'lucide:minus',
		emailColumn: 'lucide:rectangle-vertical',
		emailColumns: 'lucide:columns-3',
		emailSection: 'lucide:square',
		paragraph: 'lucide:pilcrow',
		heading: 'lucide:heading',
		bulletList: 'lucide:list',
		orderedList: 'lucide:list-ordered',
		blockquote: 'lucide:text-quote'
	};

	// Text blocks only have spacing; the email's settings stay visible below them.
	const showFallback = $derived(blocks.every((block) => TEXT_BLOCK_TYPES.includes(block.type)));
</script>

<Inspector.Root class={className}>
	{#each blocks as block (`${block.type}-${block.position}`)}
		<Inspector.Section title={BLOCK_LABELS[block.type]} icon={ICONS[block.type]}>
			{#snippet actions()}
				<InspectorActions editor={context.editor!} {block} />
			{/snippet}

			{#if block.type === 'emailButton'}
				<InspectorButton {block} />
			{:else if block.type === 'image'}
				<InspectorImage {block} />
			{:else if block.type === 'emailSpacer'}
				<InspectorSpacer {block} />
			{:else if block.type === 'horizontalRule'}
				<InspectorDivider {block} />
			{:else if block.type === 'emailColumns'}
				<InspectorColumns {block} />
			{:else if block.type === 'emailColumn'}
				<InspectorColumn {block} />
			{:else if block.type === 'emailSection'}
				<InspectorSection {block} />
			{/if}

			<InspectorSpacing {block} />
		</Inspector.Section>
	{/each}

	{#if showFallback}
		{@render fallback?.()}
	{/if}
</Inspector.Root>
