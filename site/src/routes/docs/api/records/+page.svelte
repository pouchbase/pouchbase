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
		{ id: 'list-records', title: 'List records' },
		{ id: 'get-a-record', title: 'Get a record' },
		{ id: 'create-a-record', title: 'Create a record' },
		{ id: 'update-a-record', title: 'Update a record' },
		{ id: 'delete-a-record', title: 'Delete a record' },
		{ id: 'status-codes', title: 'Status codes' }
	];

	const endpoints = [
		['GET /api/db/<collection>', 'Lists the records the list rule allows'],
		['GET /api/db/<collection>/<id>', 'One record, when the view rule allows it'],
		['POST /api/db/<collection>', 'Creates a record, when the create rule allows it'],
		['PATCH /api/db/<collection>/<id>', 'Changes a record, when the update rule allows it'],
		['DELETE /api/db/<collection>/<id>', 'Deletes a record, when the delete rule allows it']
	];

	const listParams = [
		['where', 'A condition', 'status == "published"'],
		['order', 'Fields to sort by, ascending unless :desc', 'published_at:desc,title'],
		['select', 'Only these fields', 'id,title'],
		['include', 'Relations to return as records, up to three levels', 'author,comments.author'],
		['limit', 'Records per page, 1 to 500; default 30', '20'],
		['offset', 'Matches to skip first; default 0', '40']
	];

	const statuses = [
		['200', 'The record, or the page of records'],
		['204', 'Deleted; no body'],
		[
			'400',
			'The body isn’t a JSON object, a parameter is invalid, or values are invalid (issues per field)'
		],
		[
			'401',
			'The token or API key is invalid or has expired, or the plugin of a key is no longer installed'
		],
		[
			'403',
			'The rule is Admins only, the create rule doesn’t allow the record, the rule is invalid, the action isn’t offered for the collection, or a plugin key may not use it'
		],
		['404', 'The collection or record doesn’t exist, or a rule hides the record'],
		[
			'409',
			'A unique value is taken, or a relation stops the delete (restrict, or a default value)'
		],
		['500', 'Something went wrong on the server']
	];
</script>

<DocsPage
	title="Records"
	description="List, get, create, update and delete the records of a collection over HTTP, with filters, sorting, selected fields and included relations."
	{sections}
>
	<p>
		The collection's <a href={resolve('/docs/platform/collections/access-rules')}>access rules</a>
		decide what a request may do, for the user of the token or for nobody without one; an API key acts
		as an admin and skips them. App users never see or write
		<a href="{resolve('/docs/platform/collections')}#hidden-fields">hidden fields</a>. See
		<a href="{resolve('/docs/platform/collections')}#a-record">a record</a> for what each field type returns.
	</p>

	<h2 id="endpoints">Endpoints</h2>

	<DocsTable head={['Request', 'Does']} rows={endpoints} />

	<p>
		Every call but a delete takes <Code.Root>select</Code.Root> and <Code.Root>include</Code.Root>.
		File records are at <Code.Root>/api/db/files</Code.Root>, their content at
		<a href={resolve('/docs/api/files')}>/api/files/&lt;id&gt;</a>.
	</p>

	<h2 id="list-records">List records</h2>

	<p><Code.Root>GET /api/db/&lt;collection&gt;</Code.Root> takes these query parameters:</p>

	<DocsTable head={['Parameter', 'Meaning', 'Example']} rows={listParams} />

	<p>
		See <a href={resolve('/docs/platform/collections/filters')}>Filters</a> for the syntax of
		<Code.Root>where</Code.Root>, with functions and <Code.Root>&amp;&amp;</Code.Root>,
		<Code.Root>||</Code.Root> and <Code.Root>!</Code.Root>. Without an <Code.Root>order</Code.Root>,
		records come in the order they were created. URL-encode the values:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.list} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.listResponse} />
	</CodeBlock.Root>

	<p>
		There are more pages while <Code.Root>offset + items.length &lt; total</Code.Root>. An invalid
		parameter is a <Code.Root>400</Code.Root>:
	</p>

	<CodeBlock.Root title="400 Bad Request">
		<CodeBlock.Source code={data.code.invalidQuery} />
	</CodeBlock.Root>

	<h2 id="get-a-record">Get a record</h2>

	<p>
		A record the view rule hides is a <Code.Root>404</Code.Root>, as if it didn't exist:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.get} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.getResponse} />
	</CodeBlock.Root>

	<h2 id="create-a-record">Create a record</h2>

	<p>
		Fields you leave out get their default value; ids, timestamps and computed fields are filled in.
		It answers <Code.Root>200</Code.Root> with the new record:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.create} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.createResponse} />
	</CodeBlock.Root>

	<p>
		Invalid values are a <Code.Root>400</Code.Root>, a taken unique value a <Code.Root
			>409</Code.Root
		>:
	</p>

	<CodeBlock.Root title="400 Bad Request">
		<CodeBlock.Source code={data.code.invalid} />
	</CodeBlock.Root>

	<CodeBlock.Root title="409 Conflict">
		<CodeBlock.Source code={data.code.conflict} />
	</CodeBlock.Root>

	<p>
		A record the create rule doesn't allow is a <Code.Root>403</Code.Root>, and nothing is saved.
		With a user token, <Code.Root>users</Code.Root> can't be created (users sign up),
		<Code.Root>files</Code.Root> can't be created or updated, and the <Code.Root>email</Code.Root> and
		<Code.Root>verified</Code.Root> fields of <Code.Root>users</Code.Root> can't be written.
	</p>

	<h2 id="update-a-record">Update a record</h2>

	<p>
		Send only the fields to change; an Updated field is set to now. A record the update rule doesn't
		allow is a <Code.Root>404</Code.Root>; validation errors are as for a create.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.update} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.updateResponse} />
	</CodeBlock.Root>

	<h2 id="delete-a-record">Delete a record</h2>

	<p>
		It answers <Code.Root>204</Code.Root>, or a <Code.Root>404</Code.Root> when the delete rule doesn't
		allow it. Linked records are unlinked or deleted as their relation field says; a relation with
		<Code.Root>restrict</Code.Root> stops the delete:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.remove} />
	</CodeBlock.Root>

	<CodeBlock.Root title="409 Conflict">
		<CodeBlock.Source code={data.code.restricted} />
	</CodeBlock.Root>

	<h2 id="status-codes">Status codes</h2>

	<CodeBlock.Root title="403 Forbidden">
		<CodeBlock.Source code={data.code.locked} />
	</CodeBlock.Root>

	<DocsTable head={['Status', 'Means']} rows={statuses} />
</DocsPage>
