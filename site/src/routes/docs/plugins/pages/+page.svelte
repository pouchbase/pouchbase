<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'a-page', title: 'A page' },
		{ id: 'page-options', title: 'Page options' },
		{ id: 'props', title: 'Props' }
	];

	const options = [
		{ key: 'component', about: 'The page’s Svelte component. Required.' },
		{
			key: 'title',
			about: 'Defaults to the last segment of the path: monthly-report is “Monthly report”.'
		},
		{ key: 'navigation', about: 'Whether the page gets a link in the sidebar. Default true.' },
		{
			key: 'layout',
			about:
				'default (the reading width), wide (the full width) or full (all of the space below the top bar, without padding; the page scrolls itself, e.g. an editor).'
		},
		{
			key: 'icon',
			about: 'The sidebar icon: an Iconify name or an imported .svg file.'
		}
	];
</script>

<DocsPage
	title="Dashboard pages"
	description="Add Svelte pages to the dashboard, linked in the sidebar under Plugins."
	{sections}
>
	<h2 id="a-page">A page</h2>

	<p>
		A page is an entry in <Code.Root>pages</Code.Root> of <Code.Root>definePlugin</Code.Root>, keyed
		by its path below <Code.Root>/plugins/&lt;plugin&gt;/</Code.Root>. The sidebar lists the pages
		in the order of the object.
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.pagePlugin} />
	</CodeBlock.Root>

	<p>
		Build the component from the <a href={resolve('/docs/plugins/ui')}>UI components</a> of the
		dashboard, such as
		<a href={resolve('/docs/plugins/ui/[component=slug]', { component: 'card' })}>Card</a>, so it
		looks like the rest:
	</p>

	<CodeBlock.Root title="pages/palette.svelte">
		<CodeBlock.Source code={data.code.page} />
	</CodeBlock.Root>

	<h2 id="page-options">Page options</h2>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Key</Table.Head>
				<Table.Head>What it is</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each options as { key, about } (key)}
				<Table.Row>
					<Table.Cell><Code.Root>{key}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		To keep a page's options next to its component, use <Code.Root>definePage</Code.Root> in a file of
		its own and import that into <Code.Root>plugin.ts</Code.Root>:
	</p>

	<CodeBlock.Root title="pages/settings.ts">
		<CodeBlock.Source code={data.code.definePage} />
	</CodeBlock.Root>

	<h2 id="props">Props</h2>

	<p>A page gets <Code.Root>PageProps</Code.Root>:</p>

	<ul>
		<li>
			<Code.Root>params</Code.Root>: the path below the page, such as
			<Code.Root>['2026', '10']</Code.Root> for <Code.Root
				>/plugins/&lt;plugin&gt;/reports/2026/10</Code.Root
			>. The longest matching page path wins, so <Code.Root>posts/new</Code.Root> isn't a param of
			<Code.Root>posts</Code.Root>.
		</li>
		<li>
			<Code.Root>api.fetch(path, init)</Code.Root>: calls the plugin's own
			<a href={resolve('/docs/plugins/routes')}>routes</a> with the admin's session, so
			<Code.Root>ctx.admin</Code.Root> is <Code.Root>true</Code.Root> there.
		</li>
	</ul>

	<p>
		What a page may import and how to style it is in
		<a href={resolve('/docs/plugins/components')}>Components and icons</a>.
	</p>
</DocsPage>
