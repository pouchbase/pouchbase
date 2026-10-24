<script module lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	export type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		/** What went wrong underneath, e.g. the error of D1 or the Cloudflare API. */
		reason?: string;
		/** The service error code, e.g. `23000`. */
		code?: number;
		/** Reference of an unexpected error in the server logs. */
		id?: string;
	};
</script>

<script lang="ts">
	import * as CodeBlock from '../code-block/index.js';

	let { reason, code, id, class: className, ...rest }: Props = $props();
</script>

<!-- The technical side of an error: the cause, and what to look for in the server logs. -->
{#if reason || code !== undefined || id}
	<div {...rest} class={['flex w-full flex-col gap-2', className]}>
		{#if reason}
			<CodeBlock.Root title="Cause" code={reason} class="w-full [&_pre]:whitespace-pre-wrap" />
		{/if}

		{#if code !== undefined || id}
			<p class="text-xs text-zinc-500">
				{#if code !== undefined}
					Error code <span class="font-mono text-zinc-700">{code}</span>
				{/if}
				{#if code !== undefined && id}
					·
				{/if}
				{#if id}
					Reference <span class="font-mono text-zinc-700">{id}</span>
				{/if}
				{#if !reason}
					— the server logs have the details.
				{/if}
			</p>
		{/if}
	</div>
{/if}
