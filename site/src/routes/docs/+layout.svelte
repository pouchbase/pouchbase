<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import { docsLink } from './docs-nav';
	import DocsSidebar from './docs-sidebar.svelte';

	let { children }: LayoutProps = $props();

	let menuOpen = $state(false);

	const current = $derived(docsLink(page.url.pathname));
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 lg:flex-row lg:gap-12 lg:py-14">
	<!-- On small screens the sidebar opens in a sheet, so the page starts at the top. -->
	<div class="border-b border-zinc-200 pb-4 lg:hidden">
		<Button.Root variant="ghost" class="-ml-3" onclick={() => (menuOpen = true)}>
			<Icon.Root icon="lucide:panel-left" />
			{current?.label ?? 'Documentation'}
			<Icon.Root icon="lucide:chevrons-up-down" class="text-zinc-400" />
		</Button.Root>
	</div>

	<aside class="hidden lg:block lg:w-60 lg:shrink-0">
		<DocsSidebar
			class="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain pr-2 pb-6"
		/>
	</aside>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>

<Sheet.Root bind:open={menuOpen}>
	<Sheet.Content class="max-w-sm">
		<Sheet.Header>
			<Sheet.Title>Documentation</Sheet.Title>
		</Sheet.Header>

		<Sheet.Body>
			<DocsSidebar onnavigate={() => (menuOpen = false)} />
		</Sheet.Body>
	</Sheet.Content>
</Sheet.Root>
