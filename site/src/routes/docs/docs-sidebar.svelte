<script lang="ts">
	import * as SideNav from '#lib/components/ui/side-nav/index.js';
	import DocsNavItem from './docs-nav-item.svelte';
	import { docsNavigation } from './docs-nav';

	let { onnavigate, class: className }: { onnavigate?: () => void; class?: string } = $props();
</script>

<SideNav.Root aria-label="Documentation" class={className}>
	{#each docsNavigation as group (group.label)}
		<SideNav.Group>
			<SideNav.Title>{group.label}</SideNav.Title>

			{#each group.items as item (item.label)}
				<DocsNavItem {item} {onnavigate} />
			{/each}
		</SideNav.Group>
	{/each}
</SideNav.Root>
