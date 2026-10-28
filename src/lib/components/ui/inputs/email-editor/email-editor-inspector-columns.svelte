<script lang="ts">
	import * as Inspector from '../../inspector/index.js';
	import { columnWidths } from '#lib/mail/document.js';
	import { COLUMN_LAYOUTS, setColumnLayout } from './email-editor-blocks';
	import type { SelectedBlock } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import { fieldId, updateSelectedBlock } from './email-editor-inspector-fields';

	let { block }: { block: SelectedBlock } = $props();

	const context = getEmailEditorContext();
	const attrs = $derived(block.node.attrs);
	const widths = $derived(columnWidths(block.node.toJSON().content ?? []));

	function layoutKey(values: number[]) {
		return values.join(':');
	}

	function update(values: Record<string, unknown>) {
		updateSelectedBlock(context, block, values);
	}
</script>

<Inspector.Options
	label="Columns"
	value={String(block.node.childCount)}
	options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) }))}
	onValueChange={(count) =>
		context.editor &&
		setColumnLayout(context.editor, block.position, COLUMN_LAYOUTS[Number(count)][0].widths)}
/>
{#if COLUMN_LAYOUTS[block.node.childCount].length > 1}
	<Inspector.Options
		label="Layout"
		value={layoutKey(widths)}
		options={COLUMN_LAYOUTS[block.node.childCount].map((layout) => ({
			value: layoutKey(layout.widths),
			label: layout.label
		}))}
		onValueChange={(key) =>
			context.editor && setColumnLayout(context.editor, block.position, key.split(':').map(Number))}
	/>
{/if}
<Inspector.Range
	label="Space between"
	id={fieldId(block, 'gap')}
	value={attrs.gap}
	min={0}
	max={64}
	step={4}
	onValueChange={(gap) => update({ gap })}
/>
<p class="text-xs text-zinc-500">On phones, the columns are shown below each other.</p>
