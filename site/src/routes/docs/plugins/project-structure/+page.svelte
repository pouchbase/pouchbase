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
			key: 'collections',
			adds: 'Collections by name: { notes } adds <plugin>_notes.',
			href: resolve('/docs/plugins/collections')
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
		<Code.Root>plugin.ts</Code.Root> is the plugin's single entry point. It default-exports
		<Code.Root>definePlugin(&#123; … &#125;)</Code.Root> from
		<Code.Root>@pouchbasejs/plugin-sdk/server</Code.Root>. This is the demo plugin's:
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
		All keys are optional. The <Code.Root>Register</Code.Root> block types
		<Code.Root>ctx.settings</Code.Root> everywhere in the plugin (see
		<a href={resolve('/docs/plugins/settings')}>Settings</a>).
	</p>

	<h2 id="folders">Folders</h2>

	<p>
		Nothing is read from folder or file names: a file is part of the plugin because
		<Code.Root>plugin.ts</Code.Root> imports it. <Code.Root>init</Code.Root> and
		<Code.Root>add</Code.Root> use this layout:
	</p>

	<CodeBlock.Root>
		<CodeBlock.Source code={data.code.layout} />
	</CodeBlock.Root>

	<p>
		<Code.Root>icon.svg</Code.Root> is the plugin's logo in the marketplace and the dashboard. Shared
		code, such as <Code.Root>lib/</Code.Root>, is bundled only where it's imported: into the server
		code, the components, or both.
	</p>

	<h2 id="naming">Naming</h2>

	<ul>
		<li>
			Field types and collections use lowercase letters, numbers and underscores (<Code.Root
				>rich_color</Code.Root
			>); pages and providers use lowercase words separated by dashes (<Code.Root
				>monthly-report</Code.Root
			>), pages with slashes between segments (<Code.Root>reports/monthly</Code.Root>).
		</li>
		<li>
			Route paths start with a slash. <Code.Root>:name</Code.Root> is a param, and static segments may
			also use <Code.Root>_</Code.Root> and <Code.Root>.</Code.Root>, so
			<Code.Root>'/status.json'</Code.Root> works.
		</li>
		<li>
			Field types, provider ids and collection names are stored with your data, and page and route
			paths are public URLs, so don't rename them once people use them (see
			<a href="{resolve('/docs/plugins/publishing')}#updates">Updates</a>).
		</li>
	</ul>

	<h2 id="adding-files">Adding files</h2>

	<p>
		<Code.Root>add</Code.Root> creates the files of a new field type, page, route or sign-in provider,
		never overwriting one, and adds its entry and import to <Code.Root>plugin.ts</Code.Root> (creating
		it when there is none). A field type, page or provider also gets its category in the manifest:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.add} />
	</CodeBlock.Root>

	<p>
		When the object it adds to isn't a literal, such as <Code.Root>fields: allFields</Code.Root>, it
		prints the import and entry to add by hand.
	</p>

	<h2 id="types">Types</h2>

	<p>
		<Code.Root>plugin.ts</Code.Root> imports <Code.Root>.svelte</Code.Root> and
		<Code.Root>.svg</Code.Root> files like modules. The templates' <Code.Root
			>tsconfig.json</Code.Root
		> types them (<Code.Root>svelte</Code.Root> and <Code.Root
			>@pouchbasejs/plugin-sdk/env</Code.Root
		>):
	</p>

	<CodeBlock.Root title="tsconfig.json">
		<CodeBlock.Source code={data.code.tsconfig} />
	</CodeBlock.Root>

	<p>
		Components are checked against the props they get: an input against
		<Code.Root>FieldInputProps</Code.Root>, a preview against <Code.Root
			>FieldPreviewProps</Code.Root
		>, a page against <Code.Root>PageProps</Code.Root>. <Code.Root>pnpm check</Code.Root> runs
		<Code.Root>svelte-check</Code.Root> over all of it.
	</p>

	<h2 id="how-a-build-works">How a build works</h2>

	<p>
		The CLI bundles <Code.Root>plugin.ts</Code.Root> and runs it in Node.js to read what it adds, so keep
		the top level of <Code.Root>plugin.ts</Code.Root> and the files it imports free of anything only a
		Worker has. There, an imported <Code.Root>.svelte</Code.Root> or <Code.Root>.svg</Code.Root> file
		is only a reference to the file. Then:
	</p>

	<ul>
		<li>
			the components it names, and the files they import, are compiled for the dashboard (see
			<a href={resolve('/docs/plugins/components')}>Components and icons</a>);
		</li>
		<li>
			the server code keeps only the handlers (field type hooks, provider profiles and routes),
			which run in the plugin's <a href="{resolve('/docs/plugins/routes')}#server-code">Worker</a>.
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
					<Code.Root>developer-tools</Code.Root>. Without them, the registry picks them from what
					the plugin adds.
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell><Code.Root class="whitespace-nowrap">engines.pouchbase</Code.Root></Table.Cell>
				<Table.Cell>
					The Pouchbase versions the plugin works with, as a semver range; start with <Code.Root
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
					subdomains, not <Code.Root>example.com</Code.Root> itself.
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell
					><Code.Root class="whitespace-nowrap">permissions.collections</Code.Root></Table.Cell
				>
				<Table.Cell>
					The app's collections <Code.Root>ctx.pouch</Code.Root> may <Code.Root>read</Code.Root> or
					<Code.Root>write</Code.Root> (see
					<a href={resolve('/docs/plugins/collections')}>Collections</a>).
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
		The admin sees both permissions before installing. The <Code.Root>$schema</Code.Root> line gives editors
		completion and checks. The version, description, license, author, homepage, repository and keywords
		come from <Code.Root>package.json</Code.Root>:
	</p>

	<CodeBlock.Root title="package.json">
		<CodeBlock.Source code={data.code.packageDefaults} />
	</CodeBlock.Root>

	<p>
		The CLI adds what <Code.Root>plugin.ts</Code.Root> declares when it builds, and refuses
		<Code.Root>settings</Code.Root>, <Code.Root>contributes</Code.Root> and
		<Code.Root>server</Code.Root> in <Code.Root>pouchbase-plugin.json</Code.Root>. To see the
		complete manifest:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.manifestCommand} />
	</CodeBlock.Root>
</DocsPage>
