<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'collections', title: 'Collections' },
		{ id: 'types', title: 'Types' },
		{ id: 'reading-records', title: 'Reading records' },
		{ id: 'relations', title: 'Relations' },
		{ id: 'writing-records', title: 'Writing records' },
		{ id: 'api-rules', title: 'API rules' },
		{ id: 'conditions', title: 'Conditions' },
		{ id: 'files', title: 'Files' },
		{ id: 'schema', title: 'Managing collections' },
		{ id: 'rest-api', title: 'REST API' }
	];

	const rules = [
		['Admins only', 'The default: not available through the API, only to admins in the dashboard.'],
		['Everyone', 'Also without signing in.'],
		['Signed-in users', 'Any request with a valid token ($user.id != null).'],
		[
			'Owner',
			'Only the user in a relation field to users, such as author == $user.id, or any(editors) == $user.id for a multiple relation. In users itself: the user themselves.'
		],
		[
			'Custom rule',
			'A condition; only records that match it are allowed, e.g. status == "published" or author == $user.id.'
		]
	];

	const operands = [
		['title  author.name', 'A field of the record; a dot follows a relation'],
		['"text"  \'text\'', 'A string, in double or single quotes'],
		['42  3.14', 'Numbers'],
		['true  false  null', 'Booleans, and null for an empty value'],
		['$now', 'The current date and time'],
		['$user.<field>', 'A field of the signed-in user, e.g. $user.id; null when signed out'],
		[
			'$input.<field>',
			'The value submitted for a field, in create and update rules, e.g. $input.status'
		]
	];

	const operators = [
		['==  !=', 'Equal, not equal'],
		['>  >=  <  <=', 'Greater and less than (numbers, dates and text)'],
		[
			'contains  not contains',
			'Contains, does not contain: a case-insensitive substring match; % in the text is a wildcard'
		],
		[
			'any(<field>) …',
			'True when any item of a multiple relation or list matches, e.g. any(tags) == "news"'
		],
		['and  or  ( )', 'Both, either, and parentheses for grouping'],
		['# …', 'A comment, until the end of the line']
	];

	const examples = [
		['$user.id != null', 'Signed in'],
		['author == $user.id', 'The owner, through a single relation to users'],
		['any(editors) == $user.id', 'One of the editors, through a multiple relation'],
		['status == "published" or author == $user.id', 'Published, or your own'],
		['published_at <= $now', 'Published by now'],
		['title contains "svelte"', 'The title has svelte in it, in any case'],
		['$input.author == $user.id', 'Create rule: only with yourself as the author']
	];

	const endpoints = [
		[
			'GET /api/db/<collection>',
			'Records the list rule allows; where, order, select, include, limit, offset'
		],
		['GET /api/db/<collection>/<id>', 'One record, when the view rule allows it; select, include'],
		[
			'POST /api/db/<collection>',
			'Creates a record from { <field>: value }, when the create rule allows it; select, include'
		],
		[
			'PATCH /api/db/<collection>/<id>',
			'Changes the given fields, when the update rule allows it; select, include'
		],
		['DELETE /api/db/<collection>/<id>', 'Deletes a record when the delete rule allows it; 204'],
		['GET /api/files/<id>', 'A file from the files collection; ?size=<size>, ?download'],
		['GET /api/types?token=…', 'TypeScript types of every collection; the URL is on the Types page']
	];

	const schemaEndpoints = [
		['GET /api/schema', 'Every collection with its fields, indexes, API rules and settings'],
		['GET /api/schema/<name>', 'One collection'],
		['POST /api/schema', 'Creates a collection from { name, fields, indexes, rules }; 201'],
		[
			'PATCH /api/schema/<name>',
			'Changes the given parts; ?force=true for changes that remove fields or data'
		],
		['DELETE /api/schema/<name>', 'Deletes a collection and its records; 204'],
		[
			'GET /api/schema/export',
			'An export file, { format: 2, exportedAt, collections, related }; ?collections=a,b for some of them'
		],
		['POST /api/schema/import', 'Imports an export file; ?dryRun, ?removeMissing, ?force']
	];
</script>

<DocsPage
	title="Collections and records"
	description="Model your data in collections, then read and write their records from your app, guarded by an API rule per action."
	{sections}
>
	<h2 id="collections">Collections</h2>

	<p>
		A collection is a table in the app database of your instance, with fields you define in the
		admin: text and rich text, numbers, booleans, dates, emails, URLs, JSON, lists, relations to
		other collections, files and computed fields. Every installation has two built-in collections: <Code.Root
			>users</Code.Root
		>, for the users of your app (see <a href={resolve('/docs/authentication')}>Authentication</a>),
		and
		<Code.Root>files</Code.Root>, for uploads.
	</p>

	<p>
		Collections get an id field and timestamp fields only when you add them: an <strong>ID</strong>
		field with the generator of your choice (auto-increment, UUID v4 or v7, or a random string), and
		<strong>Created</strong> and <strong>Updated</strong> fields. The <strong>API</strong> button of
		a collection sets its <a href="#api-rules">API rules</a> and shows every call below for its own fields,
		with SDK and cURL examples.
	</p>

	<h2 id="types">Types</h2>

	<p>
		The <strong>Types</strong> page of the admin has TypeScript types for your collections and a URL
		to download them. Write them to a file, for example in a <Code.Root>postinstall</Code.Root> script
		or a CI job, and pass the <Code.Root>Schema</Code.Root> to the client (see
		<a href="{resolve('/docs/authentication')}#the-sdk">The SDK</a>):
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.types} />
	</CodeBlock.Root>

	<p>
		The file has a <Code.Root>&lt;Name&gt;Record</Code.Root> (what the API returns) and a
		<Code.Root>&lt;Name&gt;Create</Code.Root> (what you send) per collection. Every collection is then
		a typed property of <Code.Root>pouch.db</Code.Root>: field names, conditions, the sort order,
		the selected fields, the values you send and the results are all checked. Collections that
		aren't in the schema are reached with <Code.Root>pouch.db.$collection('name')</Code.Root>.
	</p>

	<h2 id="reading-records">Reading records</h2>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.read} />
	</CodeBlock.Root>

	<p>
		Conditions are objects, so values never need escaping. Records come back with real values:
		booleans as booleans, JSON fields parsed, and multiple relations, files and lists as arrays
		(empty when there are none). Blob fields are left out.
	</p>

	<p>
		<Code.Root>findMany()</Code.Root> returns a page: <Code.Root>items</Code.Root>, the
		<Code.Root>total</Code.Root> number of matches, the <Code.Root>limit</Code.Root> and
		<Code.Root>offset</Code.Root> it used and <Code.Root>hasMore</Code.Root>. For the next page,
		pass <Code.Root>offset + limit</Code.Root> as the offset; <Code.Root>iterate()</Code.Root> and
		<Code.Root>findAll()</Code.Root> do that for you.
	</p>

	<h2 id="relations">Relations</h2>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.relations} />
	</CodeBlock.Root>

	<p>
		Relation and file fields hold ids. <Code.Root>include</Code.Root> returns the related records instead,
		typed from the collection they point to, on every read and on
		<Code.Root>insert()</Code.Root> and <Code.Root>patch()</Code.Root>, up to three levels deep. A
		single relation becomes a record or <Code.Root>null</Code.Root>, a multiple one an array.
		Related records that the view rule of their collection hides are left out, and including a
		collection whose view rule is Admins only fails with a 400.
	</p>

	<p>
		Each relation field sets what happens when a record it links to is deleted:
		<Code.Root>set_null</Code.Root> (the default) unlinks it, <Code.Root>cascade</Code.Root> deletes the
		linking records too, and <Code.Root>restrict</Code.Root> refuses the delete with a 409 while any record
		links to it. <Code.Root>remove()</Code.Root> throws that 409 as an error. A record that is the default
		value of a relation field can't be deleted either.
	</p>

	<h2 id="writing-records">Writing records</h2>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.write} />
	</CodeBlock.Root>

	<p>
		<Code.Root>insert()</Code.Root> takes the generated <Code.Root>&lt;Name&gt;Create</Code.Root>
		type: fields Pouchbase fills in itself (ids, timestamps, computed fields) are left out, and required
		fields are required. <Code.Root>files</Code.Root> records can only be listed, viewed and deleted through
		the API.
	</p>

	<h2 id="api-rules">API rules</h2>

	<p>
		Every collection has an API rule per action: list and search, view, create, update and delete.
		Set them with the <strong>API</strong> button of the collection, under Access rules. Each rule is
		one of:
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Rule</Table.Head>
				<Table.Head>Who may</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each rules as [rule, meaning] (rule)}
				<Table.Row>
					<Table.Cell class="font-medium whitespace-nowrap text-zinc-900">{rule}</Table.Cell>
					<Table.Cell>{meaning}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		The list rule filters the results, and the create rule is checked against the new record. A call
		that a rule locks fails with <Code.Root>forbidden</Code.Root>. Records a rule doesn't match are
		left out of lists and are "not found" otherwise: <Code.Root>null</Code.Root> from
		<Code.Root>find()</Code.Root>, <Code.Root>not_found</Code.Root> from <Code.Root
			>patch()</Code.Root
		>
		and <Code.Root>remove()</Code.Root>. The rule editor suggests fields as you type and underlines
		mistakes.
	</p>

	<p>
		Server-side code that has to manage every record, such as a back-end that writes what users may
		not, uses an API key with the <strong>service</strong> scope (<strong>System → API keys</strong
		>). The rules don't apply to it, as for an admin. Pass the key as
		<Code.Root>apiKey</Code.Root> and call the records through <Code.Root
			>pouch.asService()</Code.Root
		>:
		<Code.Root>pouch.asService().db.posts.patch(id, &#123; featured: true &#125;)</Code.Root>. Never
		put a service key in an app that runs in the browser.
	</p>

	<h2 id="conditions">Conditions</h2>

	<p>
		Custom API rules, hand-written <Code.Root>where</Code.Root> clauses and the
		<Code.Root>where</Code.Root> parameter of the REST API are all <strong>conditions</strong>: an
		expression that is true or false for a record, such as
		<Code.Root>status == "published" and views &gt; 10</Code.Root>. A condition compares
		<em>operands</em>:
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Operand</Table.Head>
				<Table.Head>Meaning</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each operands as [operand, meaning] (operand)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-pre">{operand}</Code.Root></Table.Cell>
					<Table.Cell>{meaning}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>with these operators:</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Operator</Table.Head>
				<Table.Head>Meaning</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each operators as [operator, meaning] (operator)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-pre">{operator}</Code.Root></Table.Cell>
					<Table.Cell>{meaning}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		<Code.Root>$user</Code.Root> is the user whose token came with the request. When nobody is signed
		in, every <Code.Root>$user.&lt;field&gt;</Code.Root> is <Code.Root>null</Code.Root>, so
		<Code.Root>$user.id != null</Code.Root> means "signed in". <Code.Root>$input</Code.Root> holds the
		body of a create or update request, so a rule can check what is written as well as the record it is
		written to. <Code.Root>any(…)</Code.Root> goes around a multiple relation or a list field and works
		with every comparison: <Code.Root>any(tags) contains "news"</Code.Root>. Some examples:
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Condition</Table.Head>
				<Table.Head>Matches</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each examples as [example, meaning] (example)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{example}</Code.Root></Table.Cell>
					<Table.Cell>{meaning}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		A long rule can span several lines, with a <Code.Root>#</Code.Root> comment to explain a part. For
		what the object form of <Code.Root>where</Code.Root> can't express, such as the signed-in user, write
		the condition yourself with the <Code.Root>condition</Code.Root> tag, which escapes the values you
		put in <Code.Root>{'${…}'}</Code.Root>:
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.handWritten} />
	</CodeBlock.Root>

	<h2 id="files">Files</h2>

	<p>
		Uploads are records of the built-in <Code.Root>files</Code.Root> collection, stored in R2 or in an
		S3-compatible bucket of your choice. A <strong>File</strong> field links them to a record; it can
		limit the file types and set a maximum size of up to 10 MB. Files are public by their random id:
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.files} />
	</CodeBlock.Root>

	<p>
		Thumbnails are made for the sizes listed in the settings of <Code.Root>files</Code.Root>, as
		width by height: <Code.Root>100x100</Code.Root> crops from the center,
		<Code.Root>100x100:top</Code.Root> and <Code.Root>100x100:bottom</Code.Root> crop from the top and
		bottom, <Code.Root>100x100:fit</Code.Root> fits the image without cropping, and
		<Code.Root>100x0</Code.Root> or <Code.Root>0x100</Code.Root> scale to one side. Ask for one with
		<Code.Root>?size=100x100:fit</Code.Root>. Only PNG, JPEG, GIF, WebP and AVIF images are shown
		inline; every other type is downloaded.
	</p>

	<h2 id="schema">Managing collections</h2>

	<p>
		Collections can also be managed from code, for example in a deploy script, with an API key with
		the <strong>service</strong> scope. <Code.Root>pouch.schema</Code.Root> creates, changes and deletes
		collections with their fields, indexes and API rules, and exports and imports them as a JSON file
		without records. The same export and import are in the menu next to
		<strong>Collections</strong> in the admin.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.schema} />
	</CodeBlock.Root>

	<p>
		An import creates the collections of the file and changes existing ones to match it; other
		collections stay unless you pass <Code.Root>removeMissing: true</Code.Root>. Relations to
		collections outside the file are found by name. Changes that remove fields or data fail with 409
		unless you pass <Code.Root>force: true</Code.Root>; <Code.Root>dryRun: true</Code.Root> only returns
		the plan.
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Request</Table.Head>
				<Table.Head>Purpose</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each schemaEndpoints as [request, purpose] (request)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{request}</Code.Root></Table.Cell>
					<Table.Cell>{purpose}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<h2 id="rest-api">REST API</h2>

	<p>
		What the SDK calls, for other languages and clients. Send the token of a signed-in user as
		<Code.Root>Authorization: Bearer &lt;token&gt;</Code.Root>.
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Request</Table.Head>
				<Table.Head>Purpose</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each endpoints as [request, purpose] (request)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{request}</Code.Root></Table.Cell>
					<Table.Cell>{purpose}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		A list takes <Code.Root>where</Code.Root> (a <a href="#conditions">condition</a>),
		<Code.Root>order</Code.Root> (<Code.Root>created_at:desc,title</Code.Root>; a field is sorted
		ascending unless it ends in <Code.Root>:desc</Code.Root>), <Code.Root>select</Code.Root>
		(<Code.Root>id,title</Code.Root>), <Code.Root>include</Code.Root>
		(<Code.Root>author,comments.author</Code.Root>: relations replaced by their records, which every
		call but a delete takes), <Code.Root>limit</Code.Root> (default 30, 1 to 500) and
		<Code.Root>offset</Code.Root> (default 0), and answers
		<Code.Root>{'{ items, total, limit, offset }'}</Code.Root>. An invalid parameter is a 400 with a
		message such as <Code.Root>Invalid where: …</Code.Root>. Validation errors of a create or update
		are a 400 with a message per field in <Code.Root>issues</Code.Root>.
	</p>
</DocsPage>
