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
		['404', 'There is no deployed function with this name'],
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
		Every function is at <Code.Root>/api/functions/&lt;name&gt;</Code.Root>, for any method. Writing
		and deploying them is under <a href={resolve('/docs/platform/functions')}>Functions</a>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.call} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.callResponse} />
	</CodeBlock.Root>

	<h2 id="what-is-passed-on">What is passed on</h2>

	<p>The method, headers, body, and the path and query string after the name go to the function:</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.path} />
	</CodeBlock.Root>

	<p>
		Its answer comes back as it is. Pouchbase adds CORS headers the function doesn't set, and
		<Code.Root>Content-Security-Policy: sandbox</Code.Root>, so returned HTML can't run scripts.
	</p>

	<h2 id="the-signed-in-user">The signed-in user</h2>

	<p>
		Pouchbase checks the user's token before the request reaches the function, which gets the user
		from <Code.Root>pouchbaseUser(request)</Code.Root>. An invalid or expired token is a
		<Code.Root>401</Code.Root>, and so is a call without one to a function that requires sign-in:
	</p>

	<CodeBlock.Root title="401 Unauthorized">
		<CodeBlock.Source code={data.code.signIn} />
	</CodeBlock.Root>

	<p>
		An API key counts as an invalid token. Servers, such as webhooks, call without a token, which
		works when the function doesn't require sign-in.
	</p>

	<h2 id="status-codes">Status codes</h2>

	<DocsTable head={['Status', 'Means']} rows={statuses} />
</DocsPage>
