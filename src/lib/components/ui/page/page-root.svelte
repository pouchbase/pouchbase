<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import * as ScrollArea from '../scroll-area/index.js';

	type Props = HTMLAttributes<HTMLElement> & {
		/**
		 * Gives the content all of the space below the top bar, without padding: for a page that lays
		 * itself out and scrolls itself, such as a plugin page with `layout: 'full'`.
		 */
		fill?: boolean;
	};

	let { fill = false, children, class: className, ...rest }: Props = $props();
</script>

<main {...rest} class="flex min-h-0 min-w-0 flex-1 flex-col">
	{#if fill}
		<div class={['flex min-h-0 flex-1 flex-col overflow-auto', className]}>
			{@render children?.()}
		</div>
	{:else}
		<ScrollArea.Root class="min-h-0 flex-1">
			<div class={['flex flex-col gap-6 px-8 py-8', className]}>
				{@render children?.()}
			</div>
		</ScrollArea.Root>
	{/if}
</main>
