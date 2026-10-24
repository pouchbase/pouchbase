<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { children, class: className, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<!-- What went wrong, centered: the error page of the site. -->
<div
	{...rest}
	role="alert"
	class={['mx-auto flex w-full max-w-xl flex-col items-center gap-4 text-center', className]}
>
	{@render children?.()}
</div>
