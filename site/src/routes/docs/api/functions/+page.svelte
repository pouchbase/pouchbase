<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'call-a-function', title: 'Call a function' },
		{ id: 'what-is-passed-on', title: 'What is passed on' },
		{ id: 'the-signed-in-user', title: 'The signed-in user' },
		{ id: 'status-codes', title: 'Status codes' }
	];

	const statuses = [
		['2xx–5xx', 'Whatever the function answers, passed on as it is'],
		['401', 'The token is invalid or expired, or the function requires sign-in and there is none'],
		['404', 'There is no function with this name'],
		['500', 'The function couldn’t be loaded or called'],
		['502', 'The function’s Worker couldn’t be reached']
	];
</script>

<DocsPage
	title="Functions"
	description="Call your own server-side code at /api/functions/<name>, with any method, path, query string and body, as the signed-in user."
	{sections}
>
	<h2 id="call-a-function">Call a function</h2>

	<p>
		Every function is at <Code.Root>/api/functions/&lt;name&gt;</Code.Root>, for any method:
		<Code.Root>GET</Code.Root>, <Code.Root>POST</Code.Root>, <Code.Root>PUT</Code.Root>,
		<Code.Root>PATCH</Code.Root>, <Code.Root>DELETE</Code.Root> and the rest. Writing and deploying functions
		is on the <a href={resolve('/docs/platform/functions')}>Functions</a> page of the platform docs.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.call} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.callResponse} />
	</CodeBlock.Root>

	<h2 id="what-is-passed-on">What is passed on</h2>

	<p>
		The method, the headers, the body, and the path and query string after the name go to the
		function, so one function can serve a small API of its own:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.path} />
	</CodeBlock.Root>

	<p>
		The function's answer comes back as it is, with its status and headers. Pouchbase adds CORS
		headers when the function sets none, so browsers on any origin can call it, and
		<Code.Root>Content-Security-Policy: sandbox</Code.Root>, so HTML a function returns can't run
		scripts.
	</p>

	<h2 id="the-signed-in-user">The signed-in user</h2>

	<p>
		Send the token of a signed-in user as <Code.Root>Authorization: Bearer &lt;token&gt;</Code.Root
		>. Pouchbase checks it before the request reaches the function, which gets the user from
		<Code.Root>pouchbaseUser(request)</Code.Root>. An invalid or expired token is a
		<Code.Root>401</Code.Root>, and so is a call without a token to a function that requires
		sign-in:
	</p>

	<CodeBlock.Root title="401 Unauthorized">
		<CodeBlock.Source code={data.code.signIn} />
	</CodeBlock.Root>

	<p>
		Only user tokens are checked: an API key in the <Code.Root>Authorization</Code.Root> header is refused
		as an invalid token. Calls from servers, such as webhooks, work without a token when the function
		doesn't require sign-in.
	</p>

	<h2 id="status-codes">Status codes</h2>

	<DocsTable head={['Status', 'Means']} rows={statuses} />
</DocsPage>
