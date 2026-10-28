<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
	import * as Page from '#lib/components/ui/page/index.js';
	import * as PluginComponent from '#lib/components/ui/plugin-component/index.js';
	import * as Topbar from '#lib/components/ui/topbar/index.js';
	import { getPluginPage } from '#lib/remote/plugins.remote.js';

	const id = $derived(page.params.id ?? '');
	const result = $derived(await getPluginPage({ id, path: page.params.path ?? '' }));

	const layout = $derived(result.page.layout);

	// What the plugin's page component gets: the path below the page and its own routes.
	const props = $derived<PageProps>({
		params: result.params.split('/').filter(Boolean),
		api: {
			fetch: (path, init) => fetch(`/api/plugins/${encodeURIComponent(id)}${path}`, init)
		}
	});
</script>

<svelte:head>
	<title>{result.page.title} · {result.plugin.name} · Pouchbase</title>
</svelte:head>

<Topbar.Root>
	<Breadcrumb.Root>
		<Breadcrumb.Item>
			<Breadcrumb.Link href={resolve('/(app)/plugins')}>Plugins</Breadcrumb.Link>
		</Breadcrumb.Item>
		<Breadcrumb.Separator />
		<Breadcrumb.Item>
			<span class="text-zinc-500">{result.plugin.name}</span>
		</Breadcrumb.Item>
		<Breadcrumb.Separator />
		<Breadcrumb.Item>
			<Breadcrumb.Page>{result.page.title}</Breadcrumb.Page>
		</Breadcrumb.Item>
	</Breadcrumb.Root>
</Topbar.Root>

<!-- The page's `layout`: the reading width, the full width, or all of the space without padding. -->
<Page.Root fill={layout === 'full'}>
	<div
		class={[
			'flex w-full flex-col',
			layout === 'default' && 'mx-auto max-w-5xl gap-6',
			layout === 'wide' && 'gap-6',
			layout === 'full' && 'min-h-0 flex-1'
		]}
	>
		<!-- A new page of the plugin is a new component; the same one keeps its state across params. -->
		{#key `${result.plugin.id}@${result.plugin.version}:${result.page.component}`}
			<PluginComponent.Root plugin={result.plugin} path={result.page.component} {props} />
		{/key}
	</div>
</Page.Root>
