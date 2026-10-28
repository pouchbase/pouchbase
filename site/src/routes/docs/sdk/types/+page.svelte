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
		{ id: 'email-templates', title: 'Email templates' },
		{ id: 'from-code', title: 'From code' }
	];
</script>

<DocsPage
	title="TypeScript types"
	description="Generate types for your collections and email templates, so field names, filters, the values you send, the records you get back and the emails you send are all checked by TypeScript."
	{sections}
>
	<h2 id="download-the-types">Download the types</h2>

	<p>
		The <strong>Types</strong> page of the dashboard has the URL of your types, with a token in it.
		<Code.Root>pouchbase types</Code.Root> downloads them and prints them, or writes them to the
		<Code.Root>--out</Code.Root> file. Instead of the token URL you can pass the instance URL with
		<Code.Root>--api-key</Code.Root>. Both can come from the environment:
		<Code.Root>POUCHBASE_TYPES_URL</Code.Root>, or <Code.Root>POUCHBASE_URL</Code.Root> and
		<Code.Root>POUCHBASE_API_KEY</Code.Root>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.typesCli} />
	</CodeBlock.Root>

	<p>Run it again after changing your collections or templates, for example from a script:</p>

	<CodeBlock.Root title="package.json">
		<CodeBlock.Source code={data.code.typesScript} />
	</CodeBlock.Root>

	<h2 id="what-is-in-the-file">What is in the file</h2>

	<p>
		Per collection, the file has two types, plus a <Code.Root>Schema</Code.Root> with all of them and
		<a href="#email-templates"><Code.Root>MailTemplates</Code.Root></a>:
	</p>

	<ul>
		<li>
			<Code.Root>&lt;Name&gt;Record</Code.Root>: a record as the API returns it. Only required and
			automatic fields aren't nullable; multiple fields are arrays.
			<a href="{resolve('/docs/platform/collections')}#hidden-fields">Hidden fields</a> are optional,
			since only API keys get them.
		</li>
		<li>
			<Code.Root>&lt;Name&gt;Create</Code.Root>: what to send to create one, without ids, timestamps
			and computed fields. Dates may be <Code.Root>Date</Code.Root>s.
		</li>
		<li>
			<Code.Root>Schema</Code.Root>: every collection by name, with both types and the targets of
			its relations, for <Code.Root>include</Code.Root>.
		</li>
	</ul>

	<CodeBlock.Root title="src/pouchbase.ts">
		<CodeBlock.Source code={data.code.typesFile} />
	</CodeBlock.Root>

	<h2 id="a-typed-client">A typed client</h2>

	<p>
		With the schema, every collection is a typed property of <Code.Root>pouch.db</Code.Root>;
		<Code.Root>pouch.db.$collection('name')</Code.Root> reaches others, untyped.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.typedClient} />
	</CodeBlock.Root>

	<h2 id="email-templates">Email templates</h2>

	<p>
		<Code.Root>MailTemplates</Code.Root> lists every template that
		<a href={resolve('/docs/sdk/mail')}><Code.Root>pouch.mail.send()</Code.Root></a> can send, with its
		variables. Pass it as the second type to check names and required variables:
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.typedMail} />
	</CodeBlock.Root>

	<p>
		The values are <Code.Root>unknown</Code.Root>: a template says where a value goes, not what it
		is. Built-in emails aren't in it, since only Pouchbase sends them.
	</p>

	<h2 id="from-code">From code</h2>

	<p>
		<Code.Root>fetchTypes(url)</Code.Root> downloads the types with the token URL; it fails with status
		401 when the token is missing or outdated. With an API key, use
		<Code.Root>pouch.schema.types()</Code.Root>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.fetchTypes} />
	</CodeBlock.Root>
</DocsPage>
