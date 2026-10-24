<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p {...rest} class={['max-w-md text-base leading-relaxed text-zinc-600', className]}>
	{@render children?.()}
</p>
