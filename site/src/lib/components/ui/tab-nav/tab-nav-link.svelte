<script module lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	export type Props = HTMLAnchorAttributes & {
		/** Marks the link as the part the current page is in, with `aria-current`. */
		active?: boolean;
	};
</script>

<script lang="ts">
	let { active = false, href, children, class: className, ...rest }: Props = $props();
</script>

<li class="shrink-0">
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass hrefs built with resolve() -->
	<a
		{...rest}
		{href}
		aria-current={active ? 'true' : undefined}
		class={[
			'flex items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors outline-none hover:border-zinc-300 hover:text-zinc-950 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-400 aria-[current=true]:border-brand-600 aria-[current=true]:text-brand-700 [&_svg]:size-4 [&_svg]:shrink-0',
			className
		]}
	>
		{@render children?.()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</li>
