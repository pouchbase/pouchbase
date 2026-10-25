<script lang="ts">
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as TabNav from '#lib/components/ui/tab-nav/index.js';
	import { page } from '$app/state';
	import { docsTab, docsTabs, tabHref } from './docs-nav';

	let { class: className }: { class?: string } = $props();

	const current = $derived(docsTab(page.url.pathname));
</script>

<!-- The parts of the docs; the sidebar shows the pages of the current one. -->
<TabNav.Root aria-label="Parts of the docs" class={className}>
	{#each docsTabs as tab (tab.label)}
		<TabNav.Link href={tabHref(tab)} active={tab === current} title={tab.description}>
			<Icon.Root icon={tab.icon} />
			{tab.label}
		</TabNav.Link>
	{/each}
</TabNav.Root>
