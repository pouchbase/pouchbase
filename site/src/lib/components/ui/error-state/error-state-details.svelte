<script module lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	export type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		/** What went wrong underneath, e.g. that the registry could not reach its storage. */
		reason?: string;
		/** Reference of an unexpected error in the server logs. */
		id?: string;
	};
</script>

<script lang="ts">
	let { reason, id, class: className, ...rest }: Props = $props();
</script>

<!-- The technical side of an error: the cause, and what to look for in the logs. -->
{#if reason || id}
	<div
		{...rest}
		class={[
			'flex w-full max-w-md flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm',
			className
		]}
	>
		{#if reason}
			<p class="text-zinc-700">{reason}</p>
		{/if}

		{#if id}
			<p class="text-xs text-zinc-500">
				Reference <span class="font-mono text-zinc-700">{id}</span>
			</p>
		{/if}
	</div>
{/if}
