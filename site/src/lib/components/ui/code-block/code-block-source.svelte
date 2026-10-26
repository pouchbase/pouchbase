<script lang="ts">
	import type { HighlightedCode } from '#lib/highlight.js';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLSpanElement> & {
		/** Highlighted on the server with `#lib/server/highlight.ts`. */
		code: HighlightedCode;
	};

	let { code, class: className, ...rest }: Props = $props();
</script>

<!-- Source code (a file or a snippet) instead of terminal lines, with syntax highlighting. -->
<span
	{...rest}
	data-language={code.language}
	class={['block leading-6 whitespace-pre [tab-size:2] text-zinc-100', className]}
>
	{#each code.lines as line, index (index)}
		<span class="block min-h-6">
			{#each line as token, position (position)}
				{#if token.href}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- built with resolve() on the server -->
					<a
						href={token.href}
						style:color={token.color}
						class="rounded-sm underline decoration-current/40 decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-zinc-400"
						>{token.text}</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<span style:color={token.color}>{token.text}</span>
				{/if}
			{/each}
		</span>
	{/each}
</span>
