<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '../card/index.js';

	type Props = {
		title: string;
		/** Id of the title, for `aria-labelledby` on the card's content. */
		titleId?: string;
		description?: string | Snippet;
		/** Button or menu on the right of the header. */
		actions?: Snippet;
	};

	let { title, titleId, description, actions }: Props = $props();
</script>

<Card.Header>
	<div class="flex items-start justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-1.5">
			<Card.Title id={titleId}>{title}</Card.Title>

			{#if typeof description === 'string'}
				<Card.Description>{description}</Card.Description>
			{:else if description}
				<Card.Description>{@render description()}</Card.Description>
			{/if}
		</div>

		{@render actions?.()}
	</div>
</Card.Header>
