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
		{ id: 'errors', title: 'Errors' }
	];

	const options = [
		['method', 'The HTTP method; POST with a body, GET without one by default'],
		['body', 'Sent as JSON'],
		['path', 'A path below the function, such as /42; the function reads it from request.url'],
		['query', 'Added to the URL; undefined values are left out'],
		['headers', 'Extra headers for this call'],
		['signal', 'An AbortSignal to cancel the call']
	];
</script>

<DocsPage
	title="Functions"
	description="Call your functions with pouch.functions.invoke(), with the signed-in user's token sent along."
	{sections}
>
	<h2 id="call-a-function">Call a function</h2>

	<p>
		<Code.Root>pouch.functions.invoke(name, options)</Code.Root> calls the function at
		<Code.Root>/api/functions/&lt;name&gt;</Code.Root>, with the token of the signed-in user, so the
		function knows who calls it. Write and deploy functions in the dashboard; see
		<a href={resolve('/docs/platform/functions')}>Functions</a> in the platform docs.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.invoke} />
	</CodeBlock.Root>

	<DocsTable head={['Option', 'Meaning']} rows={options} />

	<p>
		It returns the body of the answer: parsed JSON, the text when it isn't JSON, or
		<Code.Root>null</Code.Root> for an empty body. Pass the type of the answer, as in
		<Code.Root>invoke&lt;{'{ message: string }'}&gt;()</Code.Root>; the SDK doesn't check it.
	</p>

	<h2 id="errors">Errors</h2>

	<p>
		An answer that isn't 2xx throws a <a href={resolve('/docs/sdk/errors')}>PouchbaseError</a>, with
		the function's <Code.Root>message</Code.Root> when it answers JSON with one. A function that requires
		sign-in answers <Code.Root>unauthorized</Code.Root> without a valid token, and a function that doesn't
		exist <Code.Root>not_found</Code.Root>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.invokeErrors} />
	</CodeBlock.Root>
</DocsPage>
