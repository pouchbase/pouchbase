<script lang="ts">
	import type { Snippet } from 'svelte';

	import * as Icon from '@pouchbasejs/ui/icon';

	import { icons } from '../../lib/icons.js';

	type Props = {
		title: string;
		open?: boolean;
		children: Snippet;
	};

	let { title, open = $bindable(true), children }: Props = $props();

	const id = $props.id();
</script>

<!-- A panel of the sidebar that folds, like the panels of the WordPress editor. -->
<section class="border-b border-zinc-200">
	<h3>
		<button
			type="button"
			aria-expanded={open}
			aria-controls={id}
			onclick={() => (open = !open)}
			class="flex h-12 w-full items-center justify-between px-4 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50"
		>
			{title}
			<Icon.Root
				src={icons.chevronDown}
				class={`size-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
			/>
		</button>
	</h3>

	{#if open}
		<div {id} class="flex flex-col gap-3 px-4 pb-4">
			{@render children()}
		</div>
	{/if}
</section>
