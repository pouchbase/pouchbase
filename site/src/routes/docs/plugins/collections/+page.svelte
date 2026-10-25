<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'ctx-pouch', title: 'ctx.pouch' },
		{ id: 'own-collections', title: 'Own collections' },
		{ id: 'other-collections', title: 'Other collections' },
		{ id: 'updates-and-removal', title: 'Updates and removal' },
		{ id: 'testing', title: 'Testing' }
	];

	const collectionKeys = [
		{
			key: 'fields',
			about:
				'The fields in display order, as the schema API takes them: name, type, required, unique, defaultValue and options. Pouchbase adds id, created_at and updated_at when they are missing.'
		},
		{
			key: 'options.collection',
			about:
				'For a relation: the related collection by name. One of the plugin’s own collections by its key in collections, else a collection of the app, such as users.'
		},
		{ key: 'indexes', about: 'Indexes of the collection: { columns, unique }.' },
		{
			key: 'rules',
			about:
				'API rules for app users per action (list, view, create, update, delete). Missing is admins only: then only the plugin and the dashboard reach the records.'
		}
	];
</script>

<DocsPage
	title="Collections"
	description="Read and write records through the JS SDK, in collections the plugin adds and in those the admin allows."
	{sections}
>
	<h2 id="ctx-pouch">ctx.pouch</h2>

	<p>
		Every handler gets <Code.Root>ctx.pouch</Code.Root>: a client of the JS SDK, signed in as the
		plugin. It has the same
		<a href={resolve('/docs/platform/collections')}>records API</a> as in an app, through
		<Code.Root>db</Code.Root>: <Code.Root>findMany</Code.Root>,
		<Code.Root>find</Code.Root>, <Code.Root>insert</Code.Root>, <Code.Root>patch</Code.Root>,
		<Code.Root>remove</Code.Root>, with <Code.Root>where</Code.Root>, <Code.Root>orderBy</Code.Root
		>,
		<Code.Root>select</Code.Root> and <Code.Root>include</Code.Root>.
	</p>

	<CodeBlock.Root title="routes/notes.ts">
		<CodeBlock.Source code={data.code.notesRoute} />
	</CodeBlock.Root>

	<p>
		<Code.Root>ctx.pouch</Code.Root> reaches the plugin's own collections and those in
		<Code.Root>permissions.collections</Code.Root>; anything else fails with a
		<Code.Root>forbidden</Code.Root> error. The collections' API rules don't apply to the plugin, so a
		route that acts for a user checks <Code.Root>ctx.user</Code.Root> itself. Realtime, files, mail, functions
		and the schema API aren't available to plugins.
	</p>

	<h2 id="own-collections">Own collections</h2>

	<p>
		A plugin adds collections with <Code.Root>collections</Code.Root> in
		<Code.Root>definePlugin(&#123; … &#125;)</Code.Root>, by name. In Pouchbase each name gets the
		plugin id as prefix, with <Code.Root>_</Code.Root> for <Code.Root>-</Code.Root>:
		<Code.Root>notes</Code.Root> of the plugin <Code.Root>demo</Code.Root> is
		<Code.Root>demo_notes</Code.Root>. Pouchbase creates them when the plugin is installed and
		deletes them, with their records, when it is removed. The plugin can always read and write them.
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.collectionsInPlugin} />
	</CodeBlock.Root>

	<CodeBlock.Root title="collections/notes.ts">
		<CodeBlock.Source code={data.code.notesCollection} />
	</CodeBlock.Root>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Key</Table.Head>
				<Table.Head>What it is</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each collectionKeys as { key, about } (key)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{key}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		Installing fails when a collection with one of the names already exists and isn't the plugin's,
		so a plugin never takes over the app's data.
	</p>

	<h2 id="other-collections">Other collections</h2>

	<p>
		To use the app's collections, list them in <Code.Root>permissions.collections</Code.Root> of
		<Code.Root>pouchbase-plugin.json</Code.Root>: <Code.Root>read</Code.Root> to list and view records,
		<Code.Root>write</Code.Root> to also create, change and delete them.
		<Code.Root>*</Code.Root> stands for every collection. The admin sees the list before installing, next
		to <Code.Root>permissions.network</Code.Root>.
	</p>

	<CodeBlock.Root title="pouchbase-plugin.json">
		<CodeBlock.Source code={data.code.collectionPermissions} />
	</CodeBlock.Root>

	<p>
		<Code.Root>include</Code.Root> follows the same permissions: including a relation to a collection
		the plugin can't read fails.
	</p>

	<h2 id="updates-and-removal">Updates and removal</h2>

	<ul>
		<li>
			<strong>Updates</strong> bring the plugin's collections in line with the new version: new fields
			and indexes are added and changed fields are changed. Fields and indexes the new version leaves
			out stay, with their data. A change that would delete data makes the update fail.
		</li>
		<li>
			<strong>Admins</strong> can see and edit the plugin's collections in the dashboard, where they carry
			the plugin's name. Rules an admin changes stay, unless the plugin sets the same rule.
		</li>
		<li>
			<strong>Removing the plugin</strong> deletes its collections with all their records, also those
			an earlier version added; the dashboard lists them before the admin confirms. While a relation field
			of another collection points to one of them, removing fails and nothing changes: delete or change
			that field first.
		</li>
	</ul>

	<h2 id="testing">Testing</h2>

	<p>
		<Code.Root>fakePouch</Code.Root> from <Code.Root>@pouchbasejs/plugin-sdk/testing</Code.Root> is a
		<Code.Root>ctx.pouch</Code.Root> whose requests go to a function instead of Pouchbase; pass its
		<Code.Root>client</Code.Root> to <Code.Root>fakeContext</Code.Root> (see
		<a href={resolve('/docs/plugins/testing')}>Testing and debugging</a>). It answers each request
		with the JSON the API would return, or a <Code.Root>Response</Code.Root>, and lists them in
		<Code.Root>requests</Code.Root>.
	</p>

	<CodeBlock.Root title="test/notes.test.ts">
		<CodeBlock.Source code={data.code.testPouch} />
	</CodeBlock.Root>
</DocsPage>
