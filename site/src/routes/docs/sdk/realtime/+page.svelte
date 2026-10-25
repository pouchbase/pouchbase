<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'quick-start', title: 'Quick start' },
		{ id: 'a-collection', title: 'A collection' },
		{ id: 'one-record', title: 'One record' },
		{ id: 'without-the-schema', title: 'Without the schema' },
		{ id: 'the-connection', title: 'The connection' }
	];
</script>

<DocsPage
	title="Realtime"
	description="Subscribe to a collection or one record with the SDK, filter and shape the events, and follow the state of the connection."
	{sections}
>
	<h2 id="quick-start">Quick start</h2>

	<p>
		Call <Code.Root>subscribe()</Code.Root> on a collection, and <Code.Root>unsubscribe()</Code.Root
		> on what it returns when you are done. You get every create, update and delete that the collection's
		view rule lets the user see; <a href={resolve('/docs/platform/realtime')}>Realtime</a> on the platform
		explains what you receive and how it is hosted.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.quickStart} />
	</CodeBlock.Root>

	<h2 id="a-collection">A collection</h2>

	<p>
		<Code.Root>subscribe()</Code.Root> on a collection calls your callback with every change.
		<Code.Root>where</Code.Root> and <Code.Root>select</Code.Root> work as in
		<a href="{resolve('/docs/sdk/records')}#many-records">findMany</a>, and
		<Code.Root>include</Code.Root> as in
		<a href="{resolve('/docs/sdk/records')}#relations">relations</a>. It returns a subscription:
		<Code.Root>ready</Code.Root> settles when the server accepted it, and
		<Code.Root>unsubscribe()</Code.Root> ends it.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.subscribe} />
	</CodeBlock.Root>

	<h2 id="one-record">One record</h2>

	<p>Pass <Code.Root>id</Code.Root> to get only the changes to that record:</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.subscribeRecord} />
	</CodeBlock.Root>

	<h2 id="without-the-schema">Without the schema</h2>

	<p>
		Without the generated schema, subscribe to a topic on <Code.Root>pouch.realtime</Code.Root>: a
		collection, or a collection and a record id. It takes the same options, and its events aren't
		typed.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.subscribeTopic} />
	</CodeBlock.Root>

	<h2 id="the-connection">The connection</h2>

	<p>
		The SDK opens one WebSocket per collection, with the first subscription, and closes it after the
		last one unsubscribes. It reconnects by itself, and when the <a
			href="{resolve('/docs/sdk/authentication')}#session">session</a
		> begins or ends it reconnects as the new user. The server closes the connection when the token expires.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.state} />
	</CodeBlock.Root>

	<p>
		The SDK uses <Code.Root>globalThis.WebSocket</Code.Root>, which browsers, Node 22 or later,
		Deno, Bun and Workers have. Elsewhere, pass one to the client:
		<Code.Root>createClient(url, {'{ webSocket: WebSocket }'})</Code.Root>, for example from the
		<Code.Root>ws</Code.Root> package.
	</p>

	<p>
		Clients without the SDK use the WebSocket directly; see the
		<a href={resolve('/docs/api/realtime')}>realtime protocol</a>.
	</p>
</DocsPage>
