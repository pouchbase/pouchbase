<script lang="ts">
	import * as Button from '../../button/index.js';
	import * as Icon from '../../icon/index.js';
	import * as Inspector from '../../inspector/index.js';
	import type { SelectedBlock } from './email-editor-blocks';
	import { getEmailEditorContext } from './email-editor-context';
	import { ALIGN_OPTIONS, fieldId, updateSelectedBlock } from './email-editor-inspector-fields';

	let { block }: { block: SelectedBlock } = $props();

	const context = getEmailEditorContext();
	const attrs = $derived(block.node.attrs);
	const style = $derived(context.mailStyle);

	function update(values: Record<string, unknown>) {
		updateSelectedBlock(context, block, values);
	}

	/** Replaces the image with one the user picks; an empty alt text is filled in. */
	async function chooseImage() {
		const current = { src: attrs.src ?? '', alt: attrs.alt ?? '' };
		const image = await context.pickImage?.(current);

		if (image) {
			update({ src: image.src, alt: current.alt || image.alt });
		}
	}
</script>

<Inspector.Text
	label="Image URL"
	id={fieldId(block, 'src')}
	value={attrs.src ?? ''}
	placeholder={'https://… or {{imageUrl}}'}
	onValueChange={(src) => update({ src })}
/>
{#if context.pickImage}
	<Button.Root type="button" variant="secondary" onclick={() => void chooseImage()}>
		<Icon.Root icon="lucide:images" />
		Choose image…
	</Button.Root>
{/if}
<Inspector.Text
	label="Alternative text"
	id={fieldId(block, 'alt')}
	value={attrs.alt ?? ''}
	description="Shown when images are blocked, and read by screen readers."
	onValueChange={(alt) => update({ alt })}
/>
<Inspector.Text
	label="Links to"
	id={fieldId(block, 'href')}
	value={attrs.href ?? ''}
	placeholder="Optional"
	onValueChange={(href) => update({ href: href || null })}
/>
<Inspector.Options
	label="Alignment"
	value={attrs.align}
	options={[...ALIGN_OPTIONS]}
	onValueChange={(align) => update({ align })}
/>
<Inspector.Toggle
	label="Full width"
	id={fieldId(block, 'full-width')}
	checked={attrs.width === null}
	onCheckedChange={(full) => update({ width: full ? null : 240 })}
/>
{#if attrs.width !== null}
	<Inspector.Range
		label="Width"
		id={fieldId(block, 'width')}
		value={attrs.width}
		min={24}
		max={style.width}
		onValueChange={(width) => update({ width })}
	/>
{/if}
<Inspector.Range
	label="Corner radius"
	id={fieldId(block, 'radius')}
	value={attrs.radius}
	min={0}
	max={64}
	onValueChange={(radius) => update({ radius })}
/>
