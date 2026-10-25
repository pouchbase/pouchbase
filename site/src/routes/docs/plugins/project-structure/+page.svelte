<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'plugin-ts', title: 'plugin.ts' },
		{ id: 'folders', title: 'Folders' },
		{ id: 'naming', title: 'Naming' },
		{ id: 'adding-files', title: 'Adding files' },
		{ id: 'types', title: 'Types' },
		{ id: 'how-a-build-works', title: 'How a build works' },
		{ id: 'the-manifest', title: 'The manifest' }
	];

	const keys = [
		{
			key: 'settings',
			adds: 'A list of the settings an admin fills in.',
			href: resolve('/docs/plugins/settings')
		},
		{
			key: 'fields',
			adds: 'Field types by type: { color } adds <plugin>:color.',
			href: resolve('/docs/plugins/field-types')
		},
		{
			key: 'pages',
			adds: 'Dashboard pages by path: palette is /plugins/<plugin>/palette.',
			href: resolve('/docs/plugins/pages')
		},
		{
			key: 'authProviders',
			adds: 'Sign-in providers by provider id.',
			href: resolve('/docs/plugins/sign-in-providers')
		},
		{
			key: 'routes',
			adds: "Routes by path: '/items/:id' answers at /api/plugins/<plugin>/items/:id.",
			href: resolve('/docs/plugins/routes')
		}
	];
</script>

<DocsPage
	title="Project structure"
	description="plugin.ts says everything a plugin adds, the folders are yours to choose, and pouchbase-plugin.json holds what isn't code."
	{sections}
>
	<h2 id="plugin-ts">plugin.ts</h2>

	<p>
		<Code.Root>plugin.ts</Code.Root> at the root of the plugin is its single entry point. It default-exports
		<Code.Root>definePlugin(&#123; … &#125;)</Code.Root> from
		<Code.Root>@pouchbasejs/plugin-sdk/server</Code.Root>, with everything the plugin adds, by id.
		This is the demo plugin's:
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.pluginFile} />
	</CodeBlock.Root>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Key</Table.Head>
				<Table.Head>Adds</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each keys as { key, adds, href } (key)}
				<Table.Row>
					<Table.Cell>
						<a {href}><Code.Root class="whitespace-nowrap">{key}</Code.Root></a>
					</Table.Cell>
					<Table.Cell>{adds}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		All keys are optional. The <Code.Root>Register</Code.Root> block at the end types
		<Code.Root>ctx.settings</Code.Root> everywhere in the plugin (see
		<a href={resolve('/docs/plugins/settings')}>Settings</a>).
	</p>

	<h2 id="folders">Folders</h2>

	<p>
		Nothing is read from folder or file names: a field type, page or route is part of the plugin
		because <Code.Root>plugin.ts</Code.Root> imports it, wherever it lives. <Code.Root
			>init</Code.Root
		>
		and <Code.Root>add</Code.Root> use this layout, which is a good start but not a rule:
	</p>

	<CodeBlock.Root>
		<CodeBlock.Source code={data.code.layout} />
	</CodeBlock.Root>

	<ul>
		<li>
			<Code.Root>icon.svg</Code.Root> at the root is the plugin's logo in the marketplace and the dashboard,
			unless the manifest's <Code.Root>icon</Code.Root> names another file.
		</li>
		<li>
			Shared code, such as <Code.Root>lib/</Code.Root>, is only bundled where it's imported: into
			the server code, into the components, or both.
		</li>
	</ul>

	<h2 id="naming">Naming</h2>

	<p>The keys in <Code.Root>definePlugin</Code.Root> are the ids, and they are lowercase:</p>

	<ul>
		<li>
			Field types use lowercase letters, numbers and underscores (<Code.Root>rich_color</Code.Root
			>); pages and providers use lowercase words separated by dashes (<Code.Root
				>monthly-report</Code.Root
			>), and pages slashes between segments (<Code.Root>reports/monthly</Code.Root>).
		</li>
		<li>
			Route paths start with a slash. <Code.Root>:name</Code.Root> is a param, and static segments may
			also use <Code.Root>_</Code.Root> and <Code.Root>.</Code.Root>, so
			<Code.Root>'/status.json'</Code.Root> works.
		</li>
		<li>
			Field types and provider ids are stored with your data, and page and route paths are public
			URLs, so don't rename them once people use them (see
			<a href="{resolve('/docs/plugins/publishing')}#updates">Updates</a>).
		</li>
	</ul>

	<h2 id="adding-files">Adding files</h2>

	<p>
		<Code.Root>add</Code.Root> creates the files of a new field type, page, route or sign-in provider,
		never overwriting one, and adds its entry and import to <Code.Root>plugin.ts</Code.Root> (creating
		<Code.Root>plugin.ts</Code.Root> when there is none):
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.add} />
	</CodeBlock.Root>

	<p>
		When the record it adds to isn't an object literal, such as <Code.Root
			>fields: allFields</Code.Root
		>, it changes nothing and prints the import and entry to add by hand.
	</p>

	<h2 id="types">Types</h2>

	<p>
		<Code.Root>plugin.ts</Code.Root> imports <Code.Root>.svelte</Code.Root> and
		<Code.Root>.svg</Code.Root> files like modules. The templates' <Code.Root
			>tsconfig.json</Code.Root
		> types them, and checks the components too:
	</p>

	<CodeBlock.Root title="tsconfig.json">
		<CodeBlock.Source code={data.code.tsconfig} />
	</CodeBlock.Root>

	<ul>
		<li>
			<Code.Root>svelte</Code.Root> types the <Code.Root>.svelte</Code.Root> imports and
			<Code.Root>@pouchbasejs/plugin-sdk/env</Code.Root> the <Code.Root>.svg</Code.Root> imports.
		</li>
		<li>
			Components are checked against the props they get: an input against
			<Code.Root>FieldInputProps</Code.Root>, a preview against <Code.Root
				>FieldPreviewProps</Code.Root
			>
			and a page against <Code.Root>PageProps</Code.Root>.
		</li>
		<li>
			<Code.Root>pnpm check</Code.Root> runs <Code.Root>svelte-check</Code.Root> over both.
		</li>
	</ul>

	<h2 id="how-a-build-works">How a build works</h2>

	<p>
		The CLI bundles <Code.Root>plugin.ts</Code.Root> and runs it in Node.js to read what it adds, so keep
		the top level of <Code.Root>plugin.ts</Code.Root> and the files it imports free of anything only a
		Worker has. In that code, every imported <Code.Root>.svelte</Code.Root> or
		<Code.Root>.svg</Code.Root> file is a reference to the file, not code. Then:
	</p>

	<ul>
		<li>
			the components it names, and the files they import, are compiled for the dashboard (see
			<a href={resolve('/docs/plugins/components')}>Components and icons</a>);
		</li>
		<li>
			the server code keeps only the handlers: the hooks of field types, the profile of sign-in
			providers and the routes, which run in the plugin's
			<a href="{resolve('/docs/plugins/routes')}#server-code">Worker</a>.
		</li>
	</ul>

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
				<Table.Cell
					><Code.Root class="whitespace-nowrap">permissions.collections</Code.Root></Table.Cell
				>
				<Table.Cell>
					The app's collections <Code.Root>ctx.pouch</Code.Root> may <Code.Root>read</Code.Root> or
					<Code.Root>write</Code.Root>, by name or <Code.Root>*</Code.Root> (see
					<a href={resolve('/docs/plugins/collections')}>Collections</a>). The admin sees them
					before installing.
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
		When building, the CLI adds what <Code.Root>plugin.ts</Code.Root> declares, so the manifest Pouchbase
		sees is complete. <Code.Root>settings</Code.Root> in <Code.Root>pouchbase-plugin.json</Code.Root
		>
		are refused: they belong in <Code.Root>plugin.ts</Code.Root>. To check what the plugin adds,
		print the full manifest:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.manifestCommand} />
	</CodeBlock.Root>
</DocsPage>
