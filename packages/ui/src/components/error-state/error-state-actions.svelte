<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div {...rest} class={['flex flex-wrap items-center gap-2 pt-2', className]}>
	{@render children?.()}
</div>
