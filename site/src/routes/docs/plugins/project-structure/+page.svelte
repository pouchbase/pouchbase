<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'folders', title: 'Folders' },
		{ id: 'naming', title: 'Naming' },
		{ id: 'adding-files', title: 'Adding files' },
		{ id: 'the-manifest', title: 'The manifest' }
	];

	const files = [
		{
			file: 'fields/<type>/field.ts',
			adds: 'A field type, with an input.svelte next to it.',
			href: resolve('/docs/plugins/field-types')
		},
		{
			file: 'pages/<path>.svelte',
			adds: 'A dashboard page at /plugins/<plugin>/<path>.',
			href: resolve('/docs/plugins/pages')
		},
		{
			file: 'routes/<path>.ts',
			adds: 'Routes at /api/plugins/<plugin>/<path>, one export per HTTP method.',
			href: resolve('/docs/plugins/routes')
		},
		{
			file: 'auth/<id>/provider.ts',
			adds: 'A sign-in provider; an icon.svg next to it is its logo.',
			href: resolve('/docs/plugins/sign-in-providers')
		},
		{
			file: 'plugin.ts',
			adds: 'The settings an admin fills in.',
			href: resolve('/docs/plugins/settings')
		},
		{
			file: 'icon.svg',
			adds: 'The plugin’s logo in the marketplace and the dashboard.',
			href: undefined
		},
		{
			file: 'lib/',
			adds: 'Shared code, imported by the files above. Never a contribution itself.',
			href: undefined
		}
	];
</script>

<DocsPage
	title="Project structure"
	description="The folders of a plugin say what it contributes, and pouchbase-plugin.json holds what isn't code."
	{sections}
>
	<h2 id="folders">Folders</h2>

	<CodeBlock.Root>
		<CodeBlock.Source code={data.code.layout} />
	</CodeBlock.Root>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>File</Table.Head>
				<Table.Head>Adds</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each files as { file, adds, href } (file)}
				<Table.Row>
					<Table.Cell>
						{#if href}
							<a {href}><Code.Root class="whitespace-nowrap">{file}</Code.Root></a>
						{:else}
							<Code.Root class="whitespace-nowrap">{file}</Code.Root>
						{/if}
					</Table.Cell>
					<Table.Cell>{adds}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<h2 id="naming">Naming</h2>

	<ul>
		<li>
			Field types use lowercase letters, numbers and underscores (<Code.Root>rich_color</Code.Root
			>); pages and providers use lowercase words separated by dashes (<Code.Root
				>monthly-report</Code.Root
			>).
		</li>
		<li>
			Route segments may also use <Code.Root>_</Code.Root> and <Code.Root>.</Code.Root>, so
			<Code.Root>routes/status.json.ts</Code.Root> answers <Code.Root>/status.json</Code.Root>.
		</li>
		<li>
			Files and folders starting with <Code.Root>_</Code.Root>, such as
			<Code.Root>pages/_parts/header.svelte</Code.Root>, are never pages or routes, so helpers can
			live next to the files that use them. Tests and <Code.Root>.d.ts</Code.Root> files in
			<Code.Root>routes/</Code.Root> are ignored too.
		</li>
	</ul>

	<h2 id="adding-files">Adding files</h2>

	<p>
		<Code.Root>add</Code.Root> creates the files of a new contribution, and never overwrites one:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.add} />
	</CodeBlock.Root>

	<h2 id="the-manifest">The manifest</h2>

	<p><Code.Root>pouchbase-plugin.json</Code.Root> only holds what isn't code:</p>

	<CodeBlock.Root title="pouchbase-plugin.json">
		<CodeBlock.Source code={data.code.manifest} />
	</CodeBlock.Root>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Key</Table.Head>
				<Table.Head>What it is</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			<Table.Row>
				<Table.Cell><Code.Root>id</Code.Root></Table.Cell>
				<Table.Cell>
					Unique in the registry; lowercase words separated by dashes. Everything the plugin adds is
					namespaced by it, such as the field type <Code.Root>color-picker:color</Code.Root>.
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell><Code.Root>name</Code.Root></Table.Cell>
				<Table.Cell>The name in the marketplace and the dashboard.</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell><Code.Root>categories</Code.Root></Table.Cell>
				<Table.Cell>
					Up to three of <Code.Root>auth</Code.Root>, <Code.Root>fields</Code.Root>,
					<Code.Root>pages</Code.Root>, <Code.Root>integrations</Code.Root> and
					<Code.Root>developer-tools</Code.Root>. Optional: the registry picks them from what the
					plugin contributes.
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell><Code.Root class="whitespace-nowrap">engines.pouchbase</Code.Root></Table.Cell>
				<Table.Cell>
					The Pouchbase versions the plugin works with, as a semver range. Start with <Code.Root
						>&gt;=0.10.0</Code.Root
					>
					(see <a href="{resolve('/docs/plugins/publishing')}#compatibility">Compatibility</a>).
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell><Code.Root class="whitespace-nowrap">permissions.network</Code.Root></Table.Cell
				>
				<Table.Cell>
					The HTTPS hosts the server code may reach; <Code.Root>*.example.com</Code.Root> matches its
					subdomains. The admin sees them before installing.
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell><Code.Root>icon</Code.Root></Table.Cell>
				<Table.Cell>
					The path of the plugin's SVG logo; defaults to <Code.Root>icon.svg</Code.Root>.
				</Table.Cell>
			</Table.Row>
		</Table.Body>
	</Table.Root>

	<p>
		The <Code.Root>$schema</Code.Root> line gives editors completion and checks while you type. The version,
		description, license, author, homepage, repository and keywords come from
		<Code.Root>package.json</Code.Root>, so the version lives in one place:
	</p>

	<CodeBlock.Root title="package.json">
		<CodeBlock.Source code={data.code.packageDefaults} />
	</CodeBlock.Root>

	<p>
		When building, the CLI turns the folders into the full manifest that Pouchbase sees. To check
		that a file is picked up, print it:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.manifestCommand} />
	</CodeBlock.Root>
</DocsPage>
