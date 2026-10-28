<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'a-collection', title: 'A collection' },
		{ id: 'one-record', title: 'One record' },
		{ id: 'by-topic', title: 'By topic' },
		{ id: 'the-connection', title: 'The connection' }
	];
</script>

<DocsPage
	title="Realtime"
	description="Subscribe to a collection or one record with the SDK, filter and shape the events, and follow the state of the connection."
	{sections}
>
	<h2 id="a-collection">A collection</h2>

	<p>
		<Code.Root>subscribe()</Code.Root> calls your callback with every create, update and delete that the
		collection's view rule lets the user see (see
		<a href={resolve('/docs/platform/realtime')}>Realtime</a>). <Code.Root>where</Code.Root> and
		<Code.Root>select</Code.Root> work as in
		<a href="{resolve('/docs/sdk/records')}#many-records">findMany</a>, and
		<Code.Root>include</Code.Root> as in
		<a href="{resolve('/docs/sdk/records')}#relations">relations</a>. <Code.Root>ready</Code.Root>
		settles when the server accepted the subscription.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.subscribe} />
	</CodeBlock.Root>

	<h2 id="one-record">One record</h2>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.subscribeRecord} />
	</CodeBlock.Root>

	<h2 id="by-topic">By topic</h2>

	<p>
		<Code.Root>pouch.realtime.subscribe()</Code.Root> takes a topic, a collection or
		<Code.Root>collection/id</Code.Root>, with the same options and types. A collection that isn't
		in the schema works too, with untyped events.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.subscribeTopic} />
	</CodeBlock.Root>

	<h2 id="the-connection">The connection</h2>

	<p>
		The SDK opens one WebSocket per collection with the first subscription and closes it after the
		last one. It reconnects by itself, also as the new user when the
		<a href="{resolve('/docs/sdk/authentication')}#session">session</a> begins or ends. The server
		closes the connection when the token expires. A client with an
		<a href="{resolve('/docs/sdk/api-keys')}#admin-access"><Code.Root>apiKey</Code.Root></a> connects
		with the key and sees every change.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.state} />
	</CodeBlock.Root>

	<p>
		Where there is no <Code.Root>globalThis.WebSocket</Code.Root> (Node before 22), pass one:
		<Code.Root>createClient(url, {'{ webSocket: WebSocket }'})</Code.Root>, for example from
		<Code.Root>ws</Code.Root>. Clients without the SDK use the
		<a href={resolve('/docs/api/realtime')}>realtime protocol</a>.
	</p>
</DocsPage>
