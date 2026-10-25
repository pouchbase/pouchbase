<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'send-a-template', title: 'Send a template' },
		{ id: 'errors', title: 'Errors' }
	];

	const failures = [
		['401', 'No apiKey, or an invalid one'],
		['404', 'No template with this name'],
		['422', 'A required variable is missing; issues has one per variable'],
		['503', 'Sending email isn’t set up']
	];
</script>

<DocsPage
	title="Email"
	description="Send the email templates of the dashboard from a function or your back-end with pouch.mail.send()."
	{sections}
>
	<h2 id="send-a-template">Send a template</h2>

	<p>
		Make templates in the dashboard, under <strong>System → Mail</strong> (see
		<a href={resolve('/docs/platform/email')}>Email templates</a>). Sending needs an
		<a href={resolve('/docs/sdk/api-keys')}>API key</a>, so it only works in server-side code, such
		as a function:
	</p>

	<CodeBlock.Root title="function.ts">
		<CodeBlock.Source code={data.code.sendMail} />
	</CodeBlock.Root>

	<p>
		<Code.Root>to</Code.Root> is one address or a list of up to 50; every recipient gets an email of their
		own, with the same <Code.Root>variables</Code.Root>. It resolves with
		<Code.Root>{'{ sent }'}</Code.Root>, the number of emails sent. The built-in emails, such as the
		verification email, can't be sent this way.
	</p>

	<h2 id="errors">Errors</h2>

	<p>A failed send throws a <a href={resolve('/docs/sdk/errors')}>PouchbaseError</a>:</p>

	<DocsTable head={['Status', 'When']} rows={failures} />

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.mailErrors} />
	</CodeBlock.Root>
</DocsPage>
