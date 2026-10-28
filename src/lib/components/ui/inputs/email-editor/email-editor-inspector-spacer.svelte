<script lang="ts">
	import * as Inspector from '../../inspector/index.js';
	import type { SelectedBlock } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import { fieldId, updateSelectedBlock } from './email-editor-inspector-fields';

	let { block }: { block: SelectedBlock } = $props();

	const context = getEmailEditorContext();
	const attrs = $derived(block.node.attrs);

	function update(values: Record<string, unknown>) {
		updateSelectedBlock(context, block, values);
	}
</script>

<Inspector.Range
	label="Height"
	id={fieldId(block, 'height')}
	value={attrs.height}
	min={4}
	max={160}
	step={4}
	onValueChange={(height) => update({ height })}
/>
