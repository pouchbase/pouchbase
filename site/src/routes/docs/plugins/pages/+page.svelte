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
		{ key: 'component', about: 'The page: a Svelte component, imported like a module. Required.' },
		{
			key: 'title',
			about:
				'The page title. Defaults to the last segment of the path: monthly-report is “Monthly report”.'
		},
		{ key: 'navigation', about: 'Whether the page gets a link in the sidebar. Default true.' },
		{
			key: 'icon',
			about: 'The icon of the sidebar link: an Iconify name or an imported .svg file.'
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
		A page is an entry in <Code.Root>pages</Code.Root> of <Code.Root>definePlugin</Code.Root>. Its
		key is its path below <Code.Root>/plugins/&lt;plugin&gt;/</Code.Root>:
		<Code.Root>palette</Code.Root> is <Code.Root>/plugins/color-picker/palette</Code.Root>, and
		<Code.Root>'reports/monthly'</Code.Root> is
		<Code.Root>/plugins/color-picker/reports/monthly</Code.Root>. The sidebar lists the pages in the
		order of the object.
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.pagePlugin} />
	</CodeBlock.Root>

	<p>The component is an ordinary Svelte component:</p>

	<CodeBlock.Root title="pages/palette.svelte">
		<CodeBlock.Source code={data.code.page} />
	</CodeBlock.Root>

	<p>
		Build pages from the <a href={resolve('/docs/ui')}>UI components</a> of the dashboard, such as
		the <a href={resolve('/docs/ui/[component]', { component: 'card' })}>Card</a> above, so they look
		like the rest of it.
	</p>

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
		To keep a page's options next to its component, write them in a file of their own with
		<Code.Root>definePage</Code.Root> from <Code.Root>@pouchbasejs/plugin-sdk/server</Code.Root>,
		and import that into <Code.Root>plugin.ts</Code.Root>:
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
