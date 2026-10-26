<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p {...rest} data-callout-title class={['font-medium', className]}>
	{@render children?.()}
</p>
