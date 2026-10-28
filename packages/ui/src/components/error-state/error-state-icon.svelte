<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		/** `error` for failures (5xx), `neutral` for things people can fix (4xx). */
		variant?: 'error' | 'neutral';
	};

	let { variant = 'error', children, class: className, ...rest }: Props = $props();

	const variants = {
		error: 'bg-red-50 text-red-600',
		neutral: 'bg-zinc-100 text-zinc-500'
	};
</script>

<div
	{...rest}
	aria-hidden="true"
	class={[
		'mb-1 flex size-10 items-center justify-center rounded-lg [&_svg]:size-5',
		variants[variant],
		className
	]}
>
	{@render children?.()}
</div>
