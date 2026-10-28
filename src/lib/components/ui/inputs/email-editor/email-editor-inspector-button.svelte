<script lang="ts">
	import * as Inspector from '../../inspector/index.js';
	import type { ButtonSize } from '#lib/mail/document.js';
	import type { SelectedBlock } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import { ALIGN_OPTIONS, fieldId, updateSelectedBlock } from './email-editor-inspector-fields';

	let { block }: { block: SelectedBlock } = $props();

	const context = getEmailEditorContext();
	const attrs = $derived(block.node.attrs);
	const style = $derived(context.mailStyle);

	const SIZE_OPTIONS: { value: ButtonSize; label: string }[] = [
		{ value: 'small', label: 'S' },
		{ value: 'medium', label: 'M' },
		{ value: 'large', label: 'L' }
	];

	function update(values: Record<string, unknown>) {
		updateSelectedBlock(context, block, values);
	}
</script>

<Inspector.Text
	label="Links to"
	id={fieldId(block, 'href')}
	value={attrs.href}
	placeholder={'https://… or {{url}}'}
	onValueChange={(href) => update({ href })}
/>
<div class="grid grid-cols-2 gap-3">
	<Inspector.Options
		label="Size"
		value={attrs.size}
		options={SIZE_OPTIONS}
		onValueChange={(size) => update({ size })}
	/>
	<Inspector.Options
		label="Alignment"
		value={attrs.textAlign ?? 'left'}
		options={[...ALIGN_OPTIONS]}
		onValueChange={(textAlign) => update({ textAlign })}
	/>
</div>
<div class="grid grid-cols-2 gap-3">
	<Inspector.Color
		label="Background"
		id={fieldId(block, 'background')}
		value={attrs.backgroundColor}
		inherited={style.buttonColor}
		resetLabel="Use the email's button color"
		onValueChange={(backgroundColor) => update({ backgroundColor })}
	/>
	<Inspector.Color
		label="Text"
		id={fieldId(block, 'text')}
		value={attrs.textColor}
		inherited={style.buttonTextColor}
		resetLabel="Use the email's button text color"
		onValueChange={(textColor) => update({ textColor })}
	/>
</div>
<Inspector.Range
	label="Corner radius"
	id={fieldId(block, 'radius')}
	value={attrs.radius}
	min={0}
	max={40}
	onValueChange={(radius) => update({ radius })}
/>
<Inspector.Toggle
	label="Full width"
	id={fieldId(block, 'full-width')}
	checked={attrs.fullWidth}
	onCheckedChange={(fullWidth) => update({ fullWidth })}
/>
