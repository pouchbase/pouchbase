<script lang="ts">
	import type { HighlightedCode } from '#lib/highlight.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Preview from '#lib/components/ui/preview/index.js';
	import type { Component } from 'svelte';

	interface Props {
		/** The example, rendered live. */
		preview: Component;
		/** Its source. */
		code: HighlightedCode;
		/** The file name shown above the source. */
		title: string;
	}

	let { preview: Example, code, title }: Props = $props();
</script>

<div class="not-prose my-6 flex flex-col">
	<!--
		The site's controls are taller than the dashboard's; the preview uses the dashboard's height
		and font, so the components look as they do in Pouchbase.
	-->
	<Preview.Root
		class="rounded-b-none border-b-0 [font-family:ui-sans-serif,system-ui,sans-serif] text-sm text-zinc-900 [--spacing-control:calc(var(--spacing)*8)]"
	>
		<Example />
	</Preview.Root>

	<CodeBlock.Root {title} class="rounded-t-none shadow-none">
		<CodeBlock.Source {code} />
	</CodeBlock.Root>
</div>
