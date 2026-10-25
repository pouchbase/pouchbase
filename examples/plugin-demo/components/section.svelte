<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: string;
		/** A link or button at the right of the heading. */
		action?: Snippet;
		children: Snippet;
	};

	let { title, description, action, children }: Props = $props();
</script>

<section class="flex flex-col gap-3">
	<div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
		<div class="flex flex-col gap-0.5">
			<h2 class="text-base font-semibold text-zinc-900">{title}</h2>

			{#if description}
				<p class="text-sm text-zinc-500">{description}</p>
			{/if}
		</div>

		{#if action}
			{@render action()}
		{/if}
	</div>

	{@render children()}
</section>
