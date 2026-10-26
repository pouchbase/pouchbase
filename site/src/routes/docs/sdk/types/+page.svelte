<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'download-the-types', title: 'Download the types' },
		{ id: 'what-is-in-the-file', title: 'What is in the file' },
		{ id: 'a-typed-client', title: 'A typed client' },
		{ id: 'from-code', title: 'From code' }
	];
</script>

<DocsPage
	title="TypeScript types"
	description="Generate types for your collections, so field names, filters, the values you send and the records you get back are all checked by TypeScript."
	{sections}
>
	<h2 id="download-the-types">Download the types</h2>

	<p>
		The <strong>Types</strong> page of the dashboard has the URL of the TypeScript types of your
		collections, with a token in it. The <Code.Root>pouchbase types</Code.Root> command of the SDK downloads
		them; <Code.Root>--out</Code.Root> writes them to a file, and without it they are printed. The URL
		can also come from <Code.Root>POUCHBASE_TYPES_URL</Code.Root>. Server-side code with an API key
		of the <Code.Root>service</Code.Root> scope can skip the token: pass the URL of the instance with
		<Code.Root>--api-key</Code.Root> (or set <Code.Root>POUCHBASE_URL</Code.Root> and
		<Code.Root>POUCHBASE_API_KEY</Code.Root>).
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.typesCli} />
	</CodeBlock.Root>

	<p>
		Run it again after changing your collections, for example in a script, a
		<Code.Root>postinstall</Code.Root> hook or a CI job:
	</p>

	<CodeBlock.Root title="package.json">
		<CodeBlock.Source code={data.code.typesScript} />
	</CodeBlock.Root>

	<h2 id="what-is-in-the-file">What is in the file</h2>

	<p>
		Per collection, the file has two types, and a <Code.Root>Schema</Code.Root> with all of them:
	</p>

	<ul>
		<li>
			<Code.Root>&lt;Name&gt;Record</Code.Root>: a record as the API returns it. Fields that are
			required or filled in by Pouchbase aren't nullable, and multiple relations, files and lists
			are arrays. <a href="{resolve('/docs/platform/collections')}#hidden-fields">Hidden fields</a> are
			optional: only a client with a service key gets them.
		</li>
		<li>
			<Code.Root>&lt;Name&gt;Create</Code.Root>: what to send to create one. Fields Pouchbase fills
			in (ids, timestamps and computed fields) are left out, required fields are required, and dates
			may be
			<Code.Root>Date</Code.Root>s.
		</li>
		<li>
			<Code.Root>Schema</Code.Root>: every collection by name, with both types and the collection
			each relation points to, for <Code.Root>include</Code.Root>.
		</li>
	</ul>

	<CodeBlock.Root title="src/pouchbase.ts">
		<CodeBlock.Source code={data.code.typesFile} />
	</CodeBlock.Root>

	<p>
		List fields become a union of their items, and each field has a comment with its type. The types
		follow what the API returns for each
		<a href="{resolve('/docs/platform/collections')}#field-types">field type</a>.
	</p>

	<h2 id="a-typed-client">A typed client</h2>

	<p>
		Pass the schema to <Code.Root>createClient()</Code.Root>, and every collection is a typed
		property of <Code.Root>pouch.db</Code.Root>. Collections that aren't in the schema are reached
		with <Code.Root>pouch.db.$collection('name')</Code.Root>, untyped.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.typedClient} />
	</CodeBlock.Root>

	<h2 id="from-code">From code</h2>

	<p>
		<Code.Root>fetchTypes(url)</Code.Root> downloads the types from code, for a build step of your own.
		It throws a <Code.Root>PouchbaseError</Code.Root> with status 401 when the token in the URL is missing
		or outdated. With an API key of the <Code.Root>service</Code.Root> scope,
		<Code.Root>pouch.schema.types()</Code.Root> returns them without a token.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.fetchTypes} />
	</CodeBlock.Root>
</DocsPage>
