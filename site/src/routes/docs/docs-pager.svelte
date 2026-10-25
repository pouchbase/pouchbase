<script lang="ts">
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as LinkCard from '#lib/components/ui/link-card/index.js';
	import { page } from '$app/state';
	import { docsNeighbours } from './docs-nav';

	const neighbours = $derived(docsNeighbours(page.url.pathname));
</script>

<!-- Links to the previous and next page of the docs, in the order of the sidebar. -->
{#if neighbours.previous || neighbours.next}
	<nav aria-label="Previous and next page" class="mt-14 grid gap-3 sm:grid-cols-2">
		{#if neighbours.previous}
			<LinkCard.Root href={neighbours.previous.href} rel="prev" class="gap-1">
				<LinkCard.Description>Previous</LinkCard.Description>
				<LinkCard.Title>
					<Icon.Root icon="lucide:arrow-left" />
					{neighbours.previous.label}
				</LinkCard.Title>
			</LinkCard.Root>
		{/if}

		{#if neighbours.next}
			<LinkCard.Root
				href={neighbours.next.href}
				rel="next"
				class="gap-1 sm:col-start-2 sm:text-right"
			>
				<LinkCard.Description>Next</LinkCard.Description>
				<LinkCard.Title class="sm:justify-end">
					{neighbours.next.label}
					<Icon.Root icon="lucide:arrow-right" />
				</LinkCard.Title>
			</LinkCard.Root>
		{/if}
	</nav>
{/if}
