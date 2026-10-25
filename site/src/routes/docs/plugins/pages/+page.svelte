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
		{
			key: 'title',
			about: 'The page title. Defaults to the file name: monthly-report.svelte is “Monthly report”.'
		},
		{ key: 'navigation', about: 'Whether the page gets a link in the sidebar. Default true.' },
		{
			key: 'order',
			about:
				'Where the page comes among the plugin’s pages: lower first. Pages without one follow, by path.'
		},
		{
			key: 'icon',
			about: 'The icon of the sidebar link: an Iconify name or the path of an .svg file.'
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
		A Svelte component in <Code.Root>pages/</Code.Root> is a page at
		<Code.Root>/plugins/&lt;plugin&gt;/&lt;path&gt;</Code.Root>:
		<Code.Root>pages/palette.svelte</Code.Root> is <Code.Root
			>/plugins/color-picker/palette</Code.Root
		>, and <Code.Root>pages/reports/index.svelte</Code.Root> is
		<Code.Root>/plugins/color-picker/reports</Code.Root>.
	</p>

	<CodeBlock.Root title="pages/palette.svelte">
		<CodeBlock.Source code={data.code.page} />
	</CodeBlock.Root>

	<h2 id="page-options">Page options</h2>

	<p>
		<Code.Root>page</Code.Root> in the <Code.Root>&lt;script module&gt;</Code.Root> sets these, all optional:
	</p>

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
		The CLI reads <Code.Root>page</Code.Root> without running the component, so it must be a literal:
		no variables or function calls, apart from <Code.Root>definePage(&#123; … &#125;)</Code.Root> from
		<Code.Root>@pouchbasejs/plugin-sdk/ui</Code.Root>.
	</p>

	<h2 id="props">Props</h2>

	<p>A page gets <Code.Root>PageProps</Code.Root>:</p>

	<ul>
		<li>
			<Code.Root>params</Code.Root>: the path below the page, such as
			<Code.Root>['2026', '10']</Code.Root> for <Code.Root
				>/plugins/&lt;plugin&gt;/reports/2026/10</Code.Root
			>.
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
