<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	import Star from '../../components/star.svelte';
	import { MAX_RATING, RATINGS } from '../../lib/rating.js';

	let { value }: FieldPreviewProps<number> = $props();
</script>

{#if value !== null}
	<span class="inline-flex items-center" title={`${value} of ${MAX_RATING}`}>
		{#each RATINGS as rating (rating)}
			<Star filled={rating <= value} class="size-3.5" />
		{/each}
		<span class="sr-only">{value} of {MAX_RATING}</span>
	</span>
{/if}
