<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'endpoints', title: 'Endpoints' },
		{ id: 'create-a-collection', title: 'Create a collection' },
		{ id: 'change-a-collection', title: 'Change a collection' },
		{ id: 'export-and-import', title: 'Export and import' },
		{ id: 'status-codes', title: 'Status codes' },
		{ id: 'types', title: 'TypeScript types' }
	];

	const endpoints = [
		['GET /api/schema', '{ items }: every collection'],
		['GET /api/schema/<name>', 'One collection'],
		['POST /api/schema', 'Creates a collection; 201 with the collection'],
		[
			'PATCH /api/schema/<name>',
			'Changes the given parts; ?force=true for changes that remove data'
		],
		['DELETE /api/schema/<name>', 'Deletes a collection and its records; 204'],
		['GET /api/schema/export', 'An export file; ?collections=posts,comments for some of them'],
		[
			'POST /api/schema/import',
			'Applies an export file: { applied, plan }; ?dryRun=true, ?removeMissing=true, ?force=true'
		],
		['GET /api/types?token=…', 'TypeScript types of every collection, as text (token or API key)']
	];

	const body = [
		['name', 'Lowercase letters, digits and underscores'],
		[
			'fields',
			'The fields in display order: { name, type, required, unique, hidden, defaultValue, options }'
		],
		['indexes', 'Custom indexes: { columns, unique }'],
		['rules', 'An access rule per action: a condition, "" for everyone, null for admins only'],
		['thumbnails', 'Thumbnail sizes, as the files collection uses them: { enabled, sizes }']
	];

	const statuses = [
		['200', 'The collection, or the result of an import'],
		['201', 'Created: the new collection'],
		['204', 'Deleted; no body'],
		['400', 'The body isn’t valid (issues per field), or the name isn’t allowed'],
		['401', 'The API key is missing or invalid'],
		['403', 'A built-in collection can’t be renamed or deleted, or the key is a plugin’s'],
		['404', 'The collection, or a collection named in an export, doesn’t exist'],
		[
			'409',
			'The name is taken, other collections still link to it, the changes remove data without force, or a publish, pull, backup or restore is running'
		],
		[
			'422',
			'An import has relations to collections or field types this instance doesn’t have, or stopped partway ({ message, done })'
		]
	];
</script>

<DocsPage
	title="Schema and types"
	description="Create, change and delete collections with their fields, indexes and access rules over HTTP, copy them between instances, and download their TypeScript types."
	{sections}
>
	<p>
		The schema API needs an <a href={resolve('/docs/platform/api-keys')}>API key</a>, so it is for
		deploy scripts and other server-side code. Field types, rules and settings are explained under
		<a href={resolve('/docs/platform/collections')}>Collections</a>.
	</p>

	<h2 id="endpoints">Endpoints</h2>

	<DocsTable head={['Request', 'Does']} rows={endpoints} />

	<h2 id="create-a-collection">Create a collection</h2>

	<p><Code.Root>POST /api/schema</Code.Root> takes:</p>

	<DocsTable head={['Field', 'Value']} rows={body} />

	<p>
		A field's <Code.Root>type</Code.Root> is a field type id, such as <Code.Root>text</Code.Root> or
		<Code.Root>relation</Code.Root>; a relation names its collection's id in
		<Code.Root>options.collectionId</Code.Root>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.create} />
	</CodeBlock.Root>

	<p>
		It answers with the collection, as <Code.Root>GET /api/schema/&lt;name&gt;</Code.Root> returns it:
	</p>

	<CodeBlock.Root title="201 Created">
		<CodeBlock.Source code={data.code.collection} />
	</CodeBlock.Root>

	<h2 id="change-a-collection">Change a collection</h2>

	<p>
		<Code.Root>PATCH /api/schema/&lt;name&gt;</Code.Root> changes only the parts you send.
		<Code.Root>fields</Code.Root> and <Code.Root>indexes</Code.Root> are the whole list: fields matched
		by <Code.Root>id</Code.Root>, or else by name, change, new ones are added and missing ones
		deleted. <Code.Root>rules</Code.Root> keeps the actions you leave out.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.update} />
	</CodeBlock.Root>

	<p>
		Changes that delete fields or data need <Code.Root>?force=true</Code.Root>; without it, nothing
		changes and you get a <Code.Root>409</Code.Root> with the plan:
	</p>

	<CodeBlock.Root title="409 Conflict">
		<CodeBlock.Source code={data.code.destructive} />
	</CodeBlock.Root>

	<h2 id="export-and-import">Export and import</h2>

	<p>
		An export file, <Code.Root>{'{ format: 2, exportedAt, collections, related }'}</Code.Root>,
		holds collections without records; <Code.Root>related</Code.Root> lists collections that relations
		point at outside the file. An import creates the file's collections and changes existing ones, matched
		by id and then by name, to match.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.transfer} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK (dry run)">
		<CodeBlock.Source code={data.code.importResponse} />
	</CodeBlock.Root>

	<p>
		<Code.Root>?dryRun=true</Code.Root> only returns the plan. Other collections stay unless you pass
		<Code.Root>?removeMissing=true</Code.Root>; deleting collections, fields or data needs
		<Code.Root>?force=true</Code.Root>. Each step has a <Code.Root>severity</Code.Root>:
		<Code.Root>safe</Code.Root>, <Code.Root>risky</Code.Root> or <Code.Root>destructive</Code.Root>.
	</p>

	<h2 id="status-codes">Status codes</h2>

	<DocsTable head={['Status', 'Means']} rows={statuses} />

	<h2 id="types">TypeScript types</h2>

	<p>
		<Code.Root>GET /api/types</Code.Root> returns TypeScript types for every collection, as text. It takes
		the token from the <strong>Types</strong> page of the dashboard, as
		<Code.Root>?token=</Code.Root> or a bearer token, or an API key; otherwise it answers
		<Code.Root>401</Code.Root>. The <a href={resolve('/docs/sdk/types')}>SDK</a> has a command that writes
		them to a file.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.types} />
	</CodeBlock.Root>
</DocsPage>
