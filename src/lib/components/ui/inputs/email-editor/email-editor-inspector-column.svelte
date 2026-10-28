<script lang="ts">
	import * as Inspector from '../../inspector/index.js';
	import {
		columnRow,
		maxColumnWidth,
		MIN_COLUMN_WIDTH,
		resizeColumn,
		rowWidths
	} from './email-editor-columns';
	import type { SelectedBlock } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import { fieldId, updateSelectedBlock } from './email-editor-inspector-fields';

	let { block }: { block: SelectedBlock } = $props();

	const context = getEmailEditorContext();
	const attrs = $derived(block.node.attrs);
	const style = $derived(context.mailStyle);
	const row = $derived(context.editor && columnRow(context.editor, block.position));

	function update(values: Record<string, unknown>) {
		updateSelectedBlock(context, block, values);
	}
</script>

{#if row && row.row.childCount > 1}
	{@const widths = rowWidths(row.row)}
	<Inspector.Range
		label="Width"
		id={fieldId(block, 'width')}
		value={widths[row.index]}
		min={MIN_COLUMN_WIDTH}
		max={maxColumnWidth(widths, row.index)}
		unit="%"
		onValueChange={(width) => context.editor && resizeColumn(context.editor, block.position, width)}
	/>
{/if}
<Inspector.Options
	label="Vertical alignment"
	value={attrs.verticalAlign}
	options={[
		{ value: 'top', label: 'Top', icon: 'lucide:align-start-horizontal' },
		{ value: 'middle', label: 'Middle', icon: 'lucide:align-center-horizontal' },
		{ value: 'bottom', label: 'Bottom', icon: 'lucide:align-end-horizontal' }
	]}
	onValueChange={(verticalAlign) => update({ verticalAlign })}
/>
<Inspector.Color
	label="Background"
	id={fieldId(block, 'background')}
	value={attrs.backgroundColor}
	inherited={style.contentColor}
	resetLabel="No background"
	onValueChange={(backgroundColor) => update({ backgroundColor })}
/>
<Inspector.Range
	label="Padding"
	id={fieldId(block, 'padding')}
	value={attrs.padding}
	min={0}
	max={48}
	step={4}
	onValueChange={(padding) => update({ padding })}
/>
