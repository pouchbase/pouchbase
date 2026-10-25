<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'connecting', title: 'Connecting' },
		{ id: 'messages', title: 'Messages' },
		{ id: 'errors', title: 'Errors and close codes' }
	];

	const messages = [
		['auth', 'Client', '{ token? } — the first message, within 10 seconds'],
		['ready', 'Server', '{ subject, expiresAt } — authenticated; subscribe now'],
		[
			'subscribe',
			'Client',
			'{ id, record?, where?, select?, include? } — every record, or the one with id record'
		],
		['subscribed', 'Server', '{ id } — or error with the same id'],
		['unsubscribe', 'Client', '{ id }'],
		['event', 'Server', '{ id, action, record, at } — at is when the change was saved, in ms'],
		['error', 'Server', '{ id?, code, message }'],
		['ping / pong', 'Both', 'The heartbeat: send {"type":"ping"} every 30 seconds']
	];

	const closeCodes = [
		['1001', 'A deploy or restart; reconnect'],
		['4000', 'Too many invalid messages in a row'],
		['4001', 'No auth message within 10 seconds'],
		['4004', 'The collection query parameter is missing or invalid'],
		['4401', 'The token is invalid, or expired while connected']
	];
</script>

<DocsPage
	title="Protocol"
	description="Use realtime from any language: the WebSocket at /api/realtime, its messages, error codes and close codes."
	{sections}
>
	<h2 id="connecting">Connecting</h2>

	<p>
		Clients without the <a href={resolve('/docs/realtime/subscriptions')}>SDK</a> connect to
		<Code.Root>/api/realtime?collection=&lt;name&gt;</Code.Root>, authenticate, and then subscribe.
		<Code.Root>where</Code.Root> is a
		<a href="{resolve('/docs/collections')}#conditions">condition</a>, and
		<Code.Root>select</Code.Root> and <Code.Root>include</Code.Root> are arrays of field names.
	</p>

	<CodeBlock.Root title="JavaScript">
		<CodeBlock.Source code={data.code.protocol} />
	</CodeBlock.Root>

	<h2 id="messages">Messages</h2>

	<p>Every message is JSON with a <Code.Root>type</Code.Root>:</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Type</Table.Head>
				<Table.Head>From</Table.Head>
				<Table.Head>Contents</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each messages as [type, from, contents] (type)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{type}</Code.Root></Table.Cell>
					<Table.Cell>{from}</Table.Cell>
					<Table.Cell>{contents}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<h2 id="errors">Errors and close codes</h2>

	<p>
		Error codes are <Code.Root>invalid_message</Code.Root>, <Code.Root>not_authenticated</Code.Root
		>,
		<Code.Root>collection_not_found</Code.Root>, <Code.Root>forbidden</Code.Root>,
		<Code.Root>invalid_query</Code.Root>, <Code.Root>too_many_subscriptions</Code.Root> (at most 100 per
		connection), <Code.Root>duplicate_id</Code.Root> and <Code.Root>server_error</Code.Root>.
		Messages are at most 32 KB. The server closes the connection with these codes:
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Code</Table.Head>
				<Table.Head>Meaning</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each closeCodes as [code, meaning] (code)}
				<Table.Row>
					<Table.Cell><Code.Root>{code}</Code.Root></Table.Cell>
					<Table.Cell>{meaning}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</DocsPage>
