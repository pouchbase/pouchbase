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
		['GET /api/types?token=…', 'TypeScript types of every collection, as text']
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
		[
			'403',
			'The key doesn’t have the service scope, or a built-in collection can’t be renamed or deleted'
		],
		['404', 'The collection doesn’t exist'],
		[
			'409',
			'The name is taken, other collections still link to it, or the changes remove data without force'
		],
		['422', 'An import has relations to collections or field types this instance doesn’t have']
	];
</script>

<DocsPage
	title="Schema and types"
	description="Create, change and delete collections with their fields, indexes and access rules over HTTP, copy them between instances, and download their TypeScript types."
	{sections}
>
	<p>
		The schema API needs an <a href={resolve('/docs/platform/api-keys')}>API key</a> with the
		<strong>service</strong> scope, as <Code.Root>Authorization: Bearer pbk_…</Code.Root>, so it is
		for deploy scripts and other server-side code. The field types, rules and settings are explained
		in the <a href={resolve('/docs/platform/collections')}>platform docs</a>.
	</p>

	<h2 id="endpoints">Endpoints</h2>

	<DocsTable head={['Request', 'Does']} rows={endpoints} />

	<h2 id="create-a-collection">Create a collection</h2>

	<p><Code.Root>POST /api/schema</Code.Root> takes:</p>

	<DocsTable head={['Field', 'Value']} rows={body} />

	<p>
		Field <Code.Root>type</Code.Root>s are the ids of the field types, such as
		<Code.Root>text</Code.Root>, <Code.Root>rich_text</Code.Root> or <Code.Root>relation</Code.Root
		>. A relation points to a collection by its id, in <Code.Root>options.collectionId</Code.Root>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.create} />
	</CodeBlock.Root>

	<p>
		It answers <Code.Root>201</Code.Root> with the collection, in the same shape as
		<Code.Root>GET /api/schema/&lt;name&gt;</Code.Root> returns it:
	</p>

	<CodeBlock.Root title="201 Created">
		<CodeBlock.Source code={data.code.collection} />
	</CodeBlock.Root>

	<h2 id="change-a-collection">Change a collection</h2>

	<p>
		<Code.Root>PATCH /api/schema/&lt;name&gt;</Code.Root> takes the same fields, and only changes the
		ones you send. <Code.Root>fields</Code.Root> and <Code.Root>indexes</Code.Root> are the whole list:
		fields with an <Code.Root>id</Code.Root>, or else the name of an existing field, change that
		field, the others are added, and the ones left out are deleted. <Code.Root>rules</Code.Root> keeps
		the actions you leave out.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.update} />
	</CodeBlock.Root>

	<p>
		Changes that delete fields or data need <Code.Root>?force=true</Code.Root>. Without it, nothing
		changes and the answer is a <Code.Root>409</Code.Root> with the plan of what would happen:
	</p>

	<CodeBlock.Root title="409 Conflict">
		<CodeBlock.Source code={data.code.destructive} />
	</CodeBlock.Root>

	<h2 id="export-and-import">Export and import</h2>

	<p>
		An export file holds collections with their fields, indexes, rules and settings, without
		records:
		<Code.Root>{'{ format: 2, exportedAt, collections, related }'}</Code.Root>, where
		<Code.Root>related</Code.Root> lists the collections relations point at that aren't in the file. An
		import creates the collections of the file and changes existing ones to match it, matched by id and
		then by name.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.transfer} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK (dry run)">
		<CodeBlock.Source code={data.code.importResponse} />
	</CodeBlock.Root>

	<p>
		<Code.Root>?dryRun=true</Code.Root> only returns the plan, with <Code.Root
			>applied: false</Code.Root
		>. Other collections stay unless you pass <Code.Root>?removeMissing=true</Code.Root>, and
		changes that delete collections, fields or data need <Code.Root>?force=true</Code.Root>, as for
		a change. Each step of the plan has a <Code.Root>severity</Code.Root> (<Code.Root
			>safe</Code.Root
		>,
		<Code.Root>risky</Code.Root> or <Code.Root>destructive</Code.Root>) and a description in words.
	</p>

	<h2 id="status-codes">Status codes</h2>

	<DocsTable head={['Status', 'Means']} rows={statuses} />

	<h2 id="types">TypeScript types</h2>

	<p>
		<Code.Root>GET /api/types</Code.Root> returns TypeScript types for every collection, as text. It takes
		the token from the <strong>Types</strong> page of the dashboard, as
		<Code.Root>?token=</Code.Root> or <Code.Root>Authorization: Bearer</Code.Root>, instead of an
		API key; without a valid one it answers <Code.Root>401</Code.Root>. The
		<a href={resolve('/docs/sdk/types')}>SDK</a> has a command that writes them to a file.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.types} />
	</CodeBlock.Root>
</DocsPage>
