<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<!-- A live example on a dotted canvas, e.g. above the code block with its source. -->
<div
	{...rest}
	data-markdown="skip"
	class={[
		'not-prose overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 bg-[radial-gradient(var(--color-zinc-200)_1px,transparent_1px)] bg-size-[16px_16px] p-6 sm:p-10',
		className
	]}
>
	{@render children?.()}
</div>
