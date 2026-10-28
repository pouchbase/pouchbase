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
		<Code.Root>invoke()</Code.Root> calls <Code.Root>/api/functions/&lt;name&gt;</Code.Root> with the
		signed-in user's token, so the function knows who calls it. See
		<a href={resolve('/docs/platform/functions')}>Functions</a> to write them.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.invoke} />
	</CodeBlock.Root>

	<DocsTable head={['Option', 'Meaning']} rows={options} />

	<p>
		It returns parsed JSON, the text when the body isn't JSON, or <Code.Root>null</Code.Root> for an empty
		body. The type you pass is not checked.
	</p>

	<h2 id="errors">Errors</h2>

	<p>
		An answer that isn't 2xx throws a <a href={resolve('/docs/sdk/errors')}>PouchbaseError</a>, with
		the function's <Code.Root>message</Code.Root> when it answers JSON with one.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.invokeErrors} />
	</CodeBlock.Root>
</DocsPage>
