<script lang="ts">
	import * as SideNav from '#lib/components/ui/side-nav/index.js';
	import { page } from '$app/state';
	import DocsNavItem from './docs-nav-item.svelte';
	import { containsPage, isSection, type DocsItem } from './docs-nav';

	let { item, onnavigate }: { item: DocsItem; onnavigate?: () => void } = $props();

	const active = $derived(containsPage(item, page.url.pathname));

	// A section opens when the current page is in it, and can be opened and closed by hand.
	let open = $derived(active);
</script>

{#if isSection(item)}
	<SideNav.Section label={item.label} bind:open>
		{#each item.items as child (child.label)}
			<DocsNavItem item={child} {onnavigate} />
		{/each}
	</SideNav.Section>
{:else}
	<SideNav.Link href={item.href} {active} onclick={onnavigate}>{item.label}</SideNav.Link>
{/if}
