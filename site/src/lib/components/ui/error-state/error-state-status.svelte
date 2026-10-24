<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = Omit<HTMLAttributes<HTMLParagraphElement>, 'children'> & {
		/** The HTTP status, e.g. `404`. */
		status: number;
	};

	let { status, class: className, ...rest }: Props = $props();
</script>

<p
	{...rest}
	class={[
		'font-display text-7xl leading-none font-semibold tracking-tight text-brand-500 sm:text-8xl',
		className
	]}
>
	<span class="sr-only">Error</span>
	{status}
</p>
