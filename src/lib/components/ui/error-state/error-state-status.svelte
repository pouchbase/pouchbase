<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = Omit<HTMLAttributes<HTMLParagraphElement>, 'children'> & {
		/** The HTTP status, e.g. `404`. */
		status: number;
	};

	let { status, class: className, ...rest }: Props = $props();
</script>

<p {...rest} class={['font-mono text-xs font-medium text-zinc-500', className]}>
	Error {status}
</p>
