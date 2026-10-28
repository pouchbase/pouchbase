<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '../card/index.js';

	type Props = {
		title: string;
		/** Id of the title, for `aria-labelledby` on the card's content. */
		titleId?: string;
		description?: string | Snippet;
		/** Shown next to the title, e.g. status badges. */
		badges?: Snippet;
		/** Button or menu on the right of the header. */
		actions?: Snippet;
	};

	let { title, titleId, description, badges, actions }: Props = $props();
</script>

<Card.Header>
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-1.5">
			{#if badges}
				<div class="flex flex-wrap items-center gap-2">
					<Card.Title id={titleId}>{title}</Card.Title>
					{@render badges()}
				</div>
			{:else}
				<Card.Title id={titleId}>{title}</Card.Title>
			{/if}

			{#if typeof description === 'string'}
				<Card.Description>{description}</Card.Description>
			{:else if description}
				<Card.Description>{@render description()}</Card.Description>
			{/if}
		</div>

		{@render actions?.()}
	</div>
</Card.Header>
