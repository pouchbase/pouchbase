<script lang="ts">
	import * as SideNav from '#lib/components/ui/side-nav/index.js';
	import { page } from '$app/state';
	import DocsNavItem from './docs-nav-item.svelte';
	import { docsTab } from './docs-nav';

	let { onnavigate, class: className }: { onnavigate?: () => void; class?: string } = $props();

	const tab = $derived(docsTab(page.url.pathname));
</script>

<!-- The pages of the current tab of the docs. -->
<SideNav.Root aria-label="{tab.label} docs" class={className}>
	{#each tab.groups as group (group.label)}
		<SideNav.Group>
			<SideNav.Title>{group.label}</SideNav.Title>

			{#each group.items as item (item.label)}
				<DocsNavItem {item} {onnavigate} />
			{/each}
		</SideNav.Group>
	{/each}
</SideNav.Root>
