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
		{ id: 'send-a-template', title: 'Send a template' },
		{ id: 'the-body', title: 'The body' },
		{ id: 'errors', title: 'Errors' }
	];

	const body = [
		['template', 'The name of an email template, such as welcome'],
		['to', 'One address, or a list of up to 50; every recipient gets an email of their own'],
		['variables', 'The values for the template’s variables, the same for every recipient']
	];

	const statuses = [
		['200', '{ "sent": <count> }: the emails were sent'],
		['400', 'The body isn’t valid, with a message per field in issues'],
		['401', 'The API key is missing or invalid'],
		['403', 'A plugin key, or a built-in template, which Pouchbase only sends itself'],
		['404', 'There is no template with this name'],
		['422', 'A required variable is missing (issues per variable), or the template has errors'],
		['502', 'The mail provider refused or couldn’t be reached'],
		['503', 'Sending email isn’t set up'],
		['500', 'Something went wrong on the server']
	];
</script>

<DocsPage
	title="Email"
	description="Send an email template from server-side code with POST /api/mail/send and an API key."
	{sections}
>
	<h2 id="send-a-template">Send a template</h2>

	<p>
		<Code.Root>POST /api/mail/send</Code.Root> sends a template you made in the dashboard (see
		<a href={resolve('/docs/platform/email')}>Email templates</a>). It needs an
		<a href={resolve('/docs/platform/api-keys')}>API key</a> as
		<Code.Root>Authorization: Bearer pbk_…</Code.Root>, of any scope but plugin. A function has one
		in
		<Code.Root>env.POUCHBASE_API_KEY</Code.Root>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.send} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.sent} />
	</CodeBlock.Root>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:key-round" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Only from a server</Callout.Title>
			<Callout.Description>
				A user's token can't send email, and anyone with an API key can send your templates to any
				address. Never put a key in an app that runs in the browser.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="the-body">The body</h2>

	<DocsTable head={['Field', 'Value']} rows={body} />

	<p>
		Values are HTML-escaped in the email. The built-in templates, <Code.Root>verification</Code.Root
		>
		and <Code.Root>password-reset</Code.Root>, can't be sent through the API.
	</p>

	<h2 id="errors">Errors</h2>

	<p>A body that isn't valid is a <Code.Root>400</Code.Root>, with a message per field:</p>

	<CodeBlock.Root title="400 Bad Request">
		<CodeBlock.Source code={data.code.invalid} />
	</CodeBlock.Root>

	<p>
		A template variable that is required but missing is a <Code.Root>422</Code.Root>, with an issue
		per variable:
	</p>

	<CodeBlock.Root title="422 Unprocessable Content">
		<CodeBlock.Source code={data.code.missing} />
	</CodeBlock.Root>

	<DocsTable head={['Status', 'Means']} rows={statuses} />
</DocsPage>
