<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLElement> = $props();
</script>

<!-- A row of links to the parts of a section, such as the tabs of the docs, with the current one underlined. -->
<nav {...rest} class={['border-b border-zinc-200', className]}>
	<ul class="-mb-px flex gap-1 overflow-x-auto">
		{@render children?.()}
	</ul>
</nav>
