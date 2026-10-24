<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLHeadingElement> = $props();
</script>

<h1
	{...rest}
	class={['font-display text-3xl font-semibold tracking-tight text-zinc-950', className]}
>
	{@render children?.()}
</h1>
