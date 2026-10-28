<script lang="ts">
	import * as Inspector from '../../inspector/index.js';
	import { BLOCK_DEFAULTS } from '#lib/mail/document.js';
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

<Inspector.Color
	label="Color"
	id={fieldId(block, 'color')}
	value={attrs.color}
	inherited={BLOCK_DEFAULTS.divider.color}
	onValueChange={(color) => update({ color })}
/>
<Inspector.Range
	label="Thickness"
	id={fieldId(block, 'thickness')}
	value={attrs.thickness}
	min={1}
	max={8}
	onValueChange={(thickness) => update({ thickness })}
/>
