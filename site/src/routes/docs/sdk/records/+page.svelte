<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'one-record', title: 'One record' },
		{ id: 'many-records', title: 'Many records' },
		{ id: 'pages', title: 'Pages and counts' },
		{ id: 'relations', title: 'Relations' },
		{ id: 'creating', title: 'Creating' },
		{ id: 'changing-and-deleting', title: 'Changing and deleting' },
		{ id: 'errors', title: 'Errors' }
	];

	const methods = [
		['find(id)', 'One record, or null when it doesn’t exist or the view rule hides it'],
		['findOrThrow(id)', 'One record; throws a not_found error instead of returning null'],
		['findMany(options)', 'A page of matching records, with the total number of matches'],
		['findFirst(options)', 'The first match, or null'],
		['count(where)', 'How many records match'],
		['iterate(options)', 'Every match, fetched in pages as you loop over them'],
		['findAll(options)', 'Every match, in one array'],
		['insert(data)', 'Creates a record and returns it'],
		['patch(id, data)', 'Changes the given fields and returns the record'],
		['remove(id)', 'Deletes a record']
	];

	const errorKinds = [
		[
			'invalid',
			'400',
			'A value isn’t valid (a message per field in issues), or where, order, select or include is'
		],
		['unauthorized', '401', 'The token is invalid or has expired; sign in again'],
		[
			'forbidden',
			'403',
			'The rule is Admins only, the create rule doesn’t allow the record, or the API doesn’t offer the action for this collection'
		],
		[
			'not_found',
			'404',
			'The collection or record doesn’t exist, or the rule of the action hides the record'
		],
		[
			'conflict',
			'409',
			'A unique value is taken (issues names the field), or a relation stops the delete'
		],
		['network', '–', 'No response: offline, a CORS or DNS problem'],
		['server', '5xx', 'Something went wrong on the server']
	];
</script>

<DocsPage
	title="Records"
	description="Read, filter, page through, create, change and delete the records of a collection with the SDK, and see what each call returns."
	{sections}
>
	<p>
		Every collection is a property of <Code.Root>pouch.db</Code.Root>, typed by its fields when you
		pass the <a href={resolve('/docs/sdk/types')}>generated schema</a>, with these methods. Each one
		is checked against the collection’s
		<a href={resolve('/docs/platform/collections/access-rules')}>access rules</a> for the signed-in
		user. The fields and what the API returns for each type are on
		<a href={resolve('/docs/platform/collections')}>Collections</a>.
	</p>

	<DocsTable head={['Method', 'Does']} rows={methods} />

	<h2 id="one-record">One record</h2>

	<p>
		<Code.Root>find()</Code.Root> takes an id and returns the record, or <Code.Root>null</Code.Root
		>.
		<Code.Root>select</Code.Root> returns only the fields you name, which keeps responses small; the result
		type has only those fields too.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.find} />
	</CodeBlock.Root>

	<CodeBlock.Root title="Response of the select">
		<CodeBlock.Source code={data.code.findResponse} />
	</CodeBlock.Root>

	<h2 id="many-records">Many records</h2>

	<p>
		<Code.Root>findMany()</Code.Root> returns the records that match <Code.Root>where</Code.Root>
		(see <a href={resolve('/docs/sdk/filters')}>Filters</a>), sorted by
		<Code.Root>orderBy</Code.Root>. Without an order, records come in the order they were created.
		Fields in <Code.Root>orderBy</Code.Root> are sorted in the order you list them, so
		<Code.Root>{"{ status: 'asc', published_at: 'desc' }"}</Code.Root> sorts by status first.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.findMany} />
	</CodeBlock.Root>

	<CodeBlock.Root title="Response">
		<CodeBlock.Source code={data.code.findManyResponse} />
	</CodeBlock.Root>

	<p>
		<Code.Root>items</Code.Root> holds the records of this page, <Code.Root>total</Code.Root> how many
		match in all, <Code.Root>limit</Code.Root> and <Code.Root>offset</Code.Root> what the page was fetched
		with, and <Code.Root>hasMore</Code.Root> whether more records match after these. Records the list
		rule hides are left out, and aren't counted in <Code.Root>total</Code.Root>.
	</p>

	<h2 id="pages">Pages and counts</h2>

	<p>
		<Code.Root>limit</Code.Root> is 30 by default and at most 500, and <Code.Root>offset</Code.Root>
		skips that many matches first. For page <em>n</em> of <em>size</em> records, pass
		<Code.Root>offset: (n - 1) * size</Code.Root>. To go through every match, let
		<Code.Root>iterate()</Code.Root> or <Code.Root>findAll()</Code.Root> fetch the pages for you, 200
		at a time unless you pass <Code.Root>batchSize</Code.Root>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.pagination} />
	</CodeBlock.Root>

	<h2 id="relations">Relations</h2>

	<p>
		Relation and file fields hold ids. <Code.Root>include</Code.Root> returns the related records instead,
		typed from the collection they point to. A single relation becomes a record or
		<Code.Root>null</Code.Root>, a multiple one an array of records. When you also pass
		<Code.Root>select</Code.Root>, name the relation there too.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.relations} />
	</CodeBlock.Root>

	<CodeBlock.Root title="Response">
		<CodeBlock.Source code={data.code.relationsResponse} />
	</CodeBlock.Root>

	<p>
		<Code.Root>include</Code.Root> works on every read and on <Code.Root>insert()</Code.Root> and
		<Code.Root>patch()</Code.Root>, and nests up to three levels deep:
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.nestedRelations} />
	</CodeBlock.Root>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:shield-check" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Related records follow their own view rule</Callout.Title>
			<Callout.Description>
				A related record that the view rule of its collection hides is left out (<Code.Root
					>null</Code.Root
				>, or missing from the array), and including a relation to a collection whose view rule is
				Admins only fails with <Code.Root>invalid</Code.Root>.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<p>
		Each relation field sets what happens when a record it links to is deleted:
		<Code.Root>set_null</Code.Root> (the default) unlinks it, <Code.Root>cascade</Code.Root> deletes the
		linking records too (as comments go with their post), and <Code.Root>restrict</Code.Root> refuses
		the delete with a <Code.Root>conflict</Code.Root> while any record links to it. A record that is the
		default value of a relation field can't be deleted either.
	</p>

	<h2 id="creating">Creating</h2>

	<p>
		<Code.Root>insert()</Code.Root> takes the generated <Code.Root>&lt;Name&gt;Create</Code.Root>
		type: fields Pouchbase fills in itself (ids, timestamps and computed fields) are left out, and required
		fields are required. Fields you leave out get their default value. It returns the new record, with
		<Code.Root>select</Code.Root> and <Code.Root>include</Code.Root> as in
		<Code.Root>find()</Code.Root>:
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.insert} />
	</CodeBlock.Root>

	<CodeBlock.Root title="Response">
		<CodeBlock.Source code={data.code.insertResponse} />
	</CodeBlock.Root>

	<h2 id="changing-and-deleting">Changing and deleting</h2>

	<p>
		<Code.Root>patch()</Code.Root> changes only the fields you send; the others keep their value, and
		an Updated field is set to now. It returns the whole record, or what you
		<Code.Root>select</Code.Root>. <Code.Root>remove()</Code.Root> deletes a record and resolves with
		nothing. Both fail with <Code.Root>not_found</Code.Root> when the record doesn't exist or the update
		or delete rule doesn't allow it.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.patch} />
	</CodeBlock.Root>

	<h2 id="errors">Errors</h2>

	<p>
		A failed call throws a <Code.Root>PouchbaseError</Code.Root>, with the HTTP
		<Code.Root>status</Code.Root>, a <Code.Root>message</Code.Root>, a <Code.Root>kind</Code.Root>
		and, for <Code.Root>invalid</Code.Root> and <Code.Root>conflict</Code.Root>, a message per field
		in <Code.Root>issues</Code.Root>. <Code.Root>.safe()</Code.Root> on any call returns the error instead
		of throwing it; see <a href={resolve('/docs/sdk/errors')}>Errors</a>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.errors} />
	</CodeBlock.Root>

	<p>For records, the kinds mean:</p>

	<DocsTable head={['Kind', 'Status', 'When']} rows={errorKinds} />

	<p>The body of an <Code.Root>invalid</Code.Root> record has a message per field:</p>

	<CodeBlock.Root title="400 Bad Request">
		<CodeBlock.Source code={data.code.invalidResponse} />
	</CodeBlock.Root>

	<p>and a value that a unique field already has is a <Code.Root>conflict</Code.Root>:</p>

	<CodeBlock.Root title="409 Conflict">
		<CodeBlock.Source code={data.code.conflictResponse} />
	</CodeBlock.Root>
</DocsPage>
