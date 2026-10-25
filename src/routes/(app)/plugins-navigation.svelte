<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Navigation from '#lib/components/ui/navigation/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { listPluginPages } from '#lib/remote/plugins.remote.js';

	// The pages of installed plugins that asked for a link in the sidebar.
	const pages = $derived(await listPluginPages());
</script>

{#if pages.length}
	<Sidebar.Group>
		<Sidebar.GroupHeader class="h-row">
			<Sidebar.GroupLabel>Plugins</Sidebar.GroupLabel>
		</Sidebar.GroupHeader>

		<Navigation.Root aria-label="Plugins">
			{#each pages as item (`${item.pluginId}/${item.path}`)}
				{@const href = resolve('/(app)/plugins/[id]/[...path]', {
					id: item.pluginId,
					path: item.path
				})}
				<Navigation.Item>
					<!-- Also current on the paths below the page (its `params`). -->
					<Navigation.Link
						{href}
						active={page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)}
						title={`${item.title} · ${item.pluginName}`}
					>
						<!-- The page's own icon, drawn like the other links; a puzzle piece without one. -->
						<Icon.Root icon="lucide:puzzle" src={item.iconUrl} />
						<span class="truncate">{item.title}</span>
					</Navigation.Link>
				</Navigation.Item>
			{/each}
		</Navigation.Root>
	</Sidebar.Group>
{/if}
