<script lang="ts">
	import * as Inspector from '../../inspector/index.js';
	import type { SelectedBlock } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import { fieldId, updateSelectedBlock } from './email-editor-inspector-fields';

	let { block }: { block: SelectedBlock } = $props();

	const context = getEmailEditorContext();
	const attrs = $derived(block.node.attrs);
	const style = $derived(context.mailStyle);

	function update(values: Record<string, unknown>) {
		updateSelectedBlock(context, block, values);
	}
</script>

<div class="grid grid-cols-2 gap-3">
	<Inspector.Color
		label="Background"
		id={fieldId(block, 'background')}
		value={attrs.backgroundColor}
		inherited={style.contentColor}
		resetLabel="No background"
		onValueChange={(backgroundColor) => update({ backgroundColor })}
	/>
	<Inspector.Color
		label="Text"
		id={fieldId(block, 'text')}
		value={attrs.textColor}
		inherited={style.textColor}
		resetLabel="Use the email's text color"
		onValueChange={(textColor) => update({ textColor })}
	/>
</div>
<Inspector.Color
	label="Border"
	id={fieldId(block, 'border')}
	value={attrs.borderColor}
	inherited={style.contentColor}
	resetLabel="No border"
	onValueChange={(borderColor) => update({ borderColor })}
/>
<Inspector.Range
	label="Padding"
	id={fieldId(block, 'padding')}
	value={attrs.padding}
	min={0}
	max={64}
	step={4}
	onValueChange={(padding) => update({ padding })}
/>
<Inspector.Range
	label="Corner radius"
	id={fieldId(block, 'radius')}
	value={attrs.radius}
	min={0}
	max={32}
	onValueChange={(radius) => update({ radius })}
/>
