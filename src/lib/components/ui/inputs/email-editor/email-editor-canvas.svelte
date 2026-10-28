<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { HTMLAttributes } from 'svelte/elements';
	import { FONT_STACKS } from '#lib/mail/layout.js';
	import { getEmailEditorContext } from './email-editor-context';
	import DragHandle from './email-editor-drag-handle.svelte';
	import './email-editor-canvas.css';

	let { class: className, ...rest }: HTMLAttributes<HTMLDivElement> = $props();

	const context = getEmailEditorContext();
	const style = $derived(context.mailStyle);

	const mount: Attachment<HTMLDivElement> = (element) => context.mount(element);

	let card = $state<HTMLDivElement | null>(null);
</script>

<!--
	The email as it will look: the card with its colors, font and logo on its background. The
	editor's content inherits them; blocks draw their own settings (see `nodes/`).
-->
<div
	{...rest}
	class={['email-canvas-frame overflow-auto px-4 py-8', className]}
	style:background={style.backgroundColor}
	style:--mail-link={style.linkColor}
	style:--mail-button={style.buttonColor}
	style:--mail-button-text={style.buttonTextColor}
>
	<div
		bind:this={card}
		class="relative mx-auto max-w-full shadow-sm"
		style:width="{style.width}px"
		style:background={style.contentColor}
		style:color={style.textColor}
		style:font-family={FONT_STACKS[style.font]}
		style:font-size="{style.fontSize}px"
		style:padding="{style.padding}px"
		style:border-radius="{style.radius}px"
	>
		{#if style.logoUrl}
			<div class="mb-6" style:text-align={style.logoAlign}>
				{#if style.logoUrl.includes('{{')}
					<span
						class="inline-flex items-center rounded border border-dashed border-zinc-300 px-3 text-xs text-zinc-500"
						style:height="{style.logoHeight}px"
					>
						Logo: {style.logoUrl}
					</span>
				{:else}
					<img
						src={style.logoUrl}
						alt="Logo"
						class="inline-block w-auto"
						style:height="{style.logoHeight}px"
					/>
				{/if}
			</div>
		{/if}

		<div {@attach mount}></div>

		<DragHandle container={card} />
	</div>
</div>
