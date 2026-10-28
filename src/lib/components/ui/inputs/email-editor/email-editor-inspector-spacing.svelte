<script lang="ts">
	import * as Button from '../../button/index.js';
	import * as Icon from '../../icon/index.js';
	import * as Inspector from '../../inspector/index.js';
	import { BLOCK_MARGINS, blockMargins, MAX_BLOCK_MARGIN } from '#lib/mail/document.js';
	import type { SelectedBlock } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import { fieldId, updateSelectedBlock } from './email-editor-inspector-fields';

	let { block }: { block: SelectedBlock } = $props();

	const context = getEmailEditorContext();
	const attrs = $derived(block.node.attrs);
	const defaults = $derived(BLOCK_MARGINS[block.type as keyof typeof BLOCK_MARGINS]);
	const margins = $derived(defaults ? blockMargins(attrs, defaults) : null);
	const custom = $derived(attrs.marginTop != null || attrs.marginBottom != null);

	function update(values: Record<string, unknown>) {
		updateSelectedBlock(context, block, values);
	}
</script>

{#if margins}
	<div class="grid grid-cols-2 gap-3">
		<Inspector.Range
			label="Space above"
			id={fieldId(block, 'margin-top')}
			value={margins.top}
			min={0}
			max={MAX_BLOCK_MARGIN}
			onValueChange={(marginTop) => update({ marginTop })}
		/>
		<Inspector.Range
			label="Space below"
			id={fieldId(block, 'margin-bottom')}
			value={margins.bottom}
			min={0}
			max={MAX_BLOCK_MARGIN}
			onValueChange={(marginBottom) => update({ marginBottom })}
		/>
	</div>
	{#if custom}
		<Button.Root
			type="button"
			variant="ghost"
			class="self-start"
			onclick={() => update({ marginTop: null, marginBottom: null })}
		>
			<Icon.Root icon="lucide:rotate-ccw" />
			Default spacing
		</Button.Root>
	{/if}
{/if}
