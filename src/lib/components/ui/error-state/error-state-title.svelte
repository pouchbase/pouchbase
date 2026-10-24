<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLHeadingElement> = $props();
</script>

<h1 {...rest} class={['text-xl font-semibold text-zinc-900', className]}>
	{@render children?.()}
</h1>
