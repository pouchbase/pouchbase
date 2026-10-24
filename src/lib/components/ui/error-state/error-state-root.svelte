<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<!-- What went wrong, centered: the error page, or a section that could not load. -->
<div {...rest} role="alert" class={['flex w-full max-w-lg flex-col items-start gap-3', className]}>
	{@render children?.()}
</div>
