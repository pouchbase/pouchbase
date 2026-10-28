<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'create-a-collection', title: 'Create a collection' },
		{ id: 'change-and-delete', title: 'Change and delete' },
		{ id: 'export-and-import', title: 'Export and import' }
	];

	const methods = [
		['list()', 'Every collection with its fields, indexes, API rules and settings'],
		['find(name)', 'One collection, or null'],
		['create(input)', 'Creates a collection from { name, fields, indexes, rules, thumbnails }'],
		['update(name, input, { force })', 'Changes the given parts of a collection'],
		['remove(name)', 'Deletes a collection and its records'],
		['export({ collections })', 'An export file of every collection, or of some'],
		[
			'import(file, { dryRun, force, removeMissing })',
			'Applies an export file and returns the plan'
		],
		['types()', 'The generated TypeScript types, as text (see TypeScript types)']
	];
</script>

<DocsPage
	title="Schema"
	description="Create, change and delete collections with their fields, indexes and access rules from code, and copy them between instances with pouch.schema."
	{sections}
>
	<h2 id="create-a-collection">Create a collection</h2>

	<p>
		<Code.Root>pouch.schema</Code.Root> manages collections from code, for example in a deploy script,
		and needs an <a href={resolve('/docs/sdk/api-keys')}>API key</a>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.schema} />
	</CodeBlock.Root>

	<p>
		Fields are
		<Code.Root>{'{ name, type, required, unique, hidden, defaultValue, options }'}</Code.Root>, with
		a
		<a href="{resolve('/docs/platform/collections')}#field-types">field type</a> id as
		<Code.Root>type</Code.Root>. A relation points to a collection by id, in
		<Code.Root>options.collectionId</Code.Root>. <Code.Root>rules</Code.Root> takes a condition per action,
		<Code.Root>''</Code.Root> for everyone and <Code.Root>null</Code.Root> for admins only (see
		<a href={resolve('/docs/platform/collections/access-rules')}>Access rules</a>).
	</p>

	<DocsTable head={['Method', 'Does']} rows={methods} />

	<h2 id="change-and-delete">Change and delete</h2>

	<p>
		<Code.Root>update()</Code.Root> changes only the parts you pass. <Code.Root>fields</Code.Root> and
		<Code.Root>indexes</Code.Root> are the whole list, so the ones you leave out are deleted;
		<Code.Root>rules</Code.Root> keeps the actions you leave out. Changes that remove fields or data fail
		with <Code.Root>conflict</Code.Root> unless you pass <Code.Root>force: true</Code.Root>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.schemaChanges} />
	</CodeBlock.Root>

	<h2 id="export-and-import">Export and import</h2>

	<p>
		An export file holds collections without records, as in the dashboard (see
		<a href={resolve('/docs/platform/collections/schema')}>Export and import</a>). An import creates
		and changes collections to match it; others stay unless you pass
		<Code.Root>removeMissing: true</Code.Root>. <Code.Root>dryRun: true</Code.Root> only returns the plan.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.transfer} />
	</CodeBlock.Root>

	<p>
		The endpoints are on <a href={resolve('/docs/api/schema')}>Schema and types</a> in the REST API docs.
	</p>
</DocsPage>
