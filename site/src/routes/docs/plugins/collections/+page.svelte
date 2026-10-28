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
				'The fields in display order, as the schema API takes them: name, type (built-in or <plugin>:<type>), required, unique, defaultValue and options. id, created_at and updated_at are added.'
		},
		{
			key: 'options.collection',
			about:
				'For a relation: the related collection, one of the plugin’s own by its key, else one of the app’s, such as users.'
		},
		{ key: 'indexes', about: 'Indexes of the collection: { columns, unique }.' },
		{
			key: 'rules',
			about:
				'API rules for app users per action (list, view, create, update, delete). Missing is admins only, so only the plugin and the dashboard reach the records.'
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
		plugin, with the same <a href={resolve('/docs/platform/collections')}>records API</a> as an app
		(<Code.Root>findMany</Code.Root>, <Code.Root>find</Code.Root>, <Code.Root>insert</Code.Root>,
		<Code.Root>patch</Code.Root>, <Code.Root>remove</Code.Root>, …).
	</p>

	<CodeBlock.Root title="routes/notes.ts">
		<CodeBlock.Source code={data.code.notesRoute} />
	</CodeBlock.Root>

	<p>
		<Code.Root>ctx.pouch</Code.Root> reaches the plugin's own collections and those in
		<Code.Root>permissions.collections</Code.Root>; anything else fails with a
		<Code.Root>forbidden</Code.Root> error. API rules don't apply to the plugin, so a route that acts
		for a user checks <Code.Root>ctx.user</Code.Root> itself. Realtime, files, mail, functions and the
		schema API aren't available.
	</p>

	<h2 id="own-collections">Own collections</h2>

	<p>
		<Code.Root>collections</Code.Root> of <Code.Root>definePlugin</Code.Root> adds collections by name,
		prefixed with the plugin id (<Code.Root>_</Code.Root> for <Code.Root>-</Code.Root>):
		<Code.Root>notes</Code.Root> of the plugin <Code.Root>demo</Code.Root> is
		<Code.Root>demo_notes</Code.Root>. Pouchbase creates them on install, and the plugin can always
		read and write them.
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
		Installing fails when a collection with one of the names exists and isn't the plugin's, so a
		plugin never takes over the app's data.
	</p>

	<h2 id="other-collections">Other collections</h2>

	<p>
		To use the app's collections, list them in <Code.Root>permissions.collections</Code.Root> of
		<Code.Root>pouchbase-plugin.json</Code.Root>: <Code.Root>read</Code.Root> to list and view records,
		<Code.Root>write</Code.Root> to also create, change and delete them, <Code.Root>*</Code.Root> for
		every collection. The admin sees the list before installing.
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
			<strong>Updates</strong> bring the collections in line with the new version. Fields and indexes
			it leaves out stay, with their data; a change that would delete data makes the update fail.
		</li>
		<li>
			<strong>Admins</strong> can edit the plugin's collections in the dashboard. Rules an admin changes
			stay, unless the plugin sets the same rule.
		</li>
		<li>
			<strong>Removing the plugin</strong> deletes its collections with all their records, including those
			an earlier version added. It fails while a relation field of another collection points to one of
			them.
		</li>
	</ul>

	<h2 id="testing">Testing</h2>

	<p>
		<Code.Root>fakePouch</Code.Root> from <Code.Root>@pouchbasejs/plugin-sdk/testing</Code.Root> sends
		<Code.Root>ctx.pouch</Code.Root>'s requests to your function, which returns the JSON the API
		would, or a <Code.Root>Response</Code.Root>; <Code.Root>requests</Code.Root> lists them. Pass its
		<Code.Root>client</Code.Root> to <Code.Root>fakeContext</Code.Root> (see
		<a href={resolve('/docs/plugins/testing')}>Testing and debugging</a>).
	</p>

	<CodeBlock.Root title="test/notes.test.ts">
		<CodeBlock.Source code={data.code.testPouch} />
	</CodeBlock.Root>
</DocsPage>
