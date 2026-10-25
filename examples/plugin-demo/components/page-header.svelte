<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: string;
		/** Small labels above the title, e.g. badges. */
		eyebrow?: Snippet;
		/** Buttons at the right. */
		actions?: Snippet;
	};

	let { title, description, eyebrow, actions }: Props = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-4">
	<div class="flex min-w-0 flex-col gap-2">
		{#if eyebrow}
			<div class="flex flex-wrap items-center gap-1.5">{@render eyebrow()}</div>
		{/if}

		<h1 class="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>

		{#if description}
			<p class="max-w-2xl text-sm/6 text-zinc-500">{description}</p>
		{/if}
	</div>

	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</header>
