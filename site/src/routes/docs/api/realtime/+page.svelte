<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'connecting', title: 'Connecting' },
		{ id: 'messages', title: 'Messages' },
		{ id: 'events', title: 'Events' },
		{ id: 'errors', title: 'Errors and close codes' }
	];

	const messages = [
		[
			'auth',
			'Client',
			'{ token? }: the first message, within 10 seconds; a user’s token, an API key (acts as an admin), or none for anonymous'
		],
		['ready', 'Server', '{ subject, expiresAt }: authenticated as admin, user or anonymous'],
		[
			'subscribe',
			'Client',
			'{ id, record?, where?, select?, include? }: every record, or only the one with id record'
		],
		['subscribed', 'Server', '{ id }, or an error with the same id'],
		['unsubscribe', 'Client', '{ id }'],
		['unsubscribed', 'Server', '{ id }'],
		['event', 'Server', '{ id, action, record, at }: a change to a record'],
		['error', 'Server', '{ id?, code, message }'],
		['ping / pong', 'Both', 'The heartbeat: send {"type":"ping"} every 30 seconds']
	];

	const errorCodes = [
		['invalid_message', 'The message isn’t valid JSON of a known type'],
		['not_authenticated', 'A subscribe before auth, or a second auth'],
		['collection_not_found', 'The collection doesn’t exist'],
		['forbidden', 'The view rule is Admins only, or can’t run'],
		['invalid_query', 'where, select or include isn’t valid'],
		['too_many_subscriptions', 'More than 100 subscriptions on one connection'],
		['duplicate_id', 'A subscription with this id already exists'],
		['server_error', 'The server couldn’t check the subscription']
	];

	const closeCodes = [
		['1001', 'A deploy or restart; reconnect'],
		['1009', 'A message larger than 32 KB'],
		['1011', 'The server couldn’t check the token'],
		['4000', 'Too many invalid messages in a row'],
		['4001', 'No auth message within 10 seconds'],
		['4004', 'The collection query parameter is missing or invalid'],
		[
			'4401',
			'The token or API key is invalid, the key is a plugin’s, or the token expired while connected'
		]
	];
</script>

<DocsPage
	title="Realtime"
	description="Get every change to the records of a collection as it is saved, over the WebSocket at /api/realtime: connecting, the messages, and the error and close codes."
	{sections}
>
	<p>
		In TypeScript, the <a href={resolve('/docs/sdk/realtime')}>SDK</a> speaks this protocol for you.
		How realtime works is under <a href={resolve('/docs/platform/realtime')}>Realtime</a> in the platform
		docs.
	</p>

	<h2 id="connecting">Connecting</h2>

	<p>
		Open a WebSocket to <Code.Root>/api/realtime?collection=&lt;name&gt;</Code.Root>, one per
		collection. Send <Code.Root>auth</Code.Root> first, with a user's token, an API key (which skips the
		view rule) or nothing, and subscribe once the server answers <Code.Root>ready</Code.Root>. A
		plain HTTP request gets a <Code.Root>426</Code.Root>.
	</p>

	<CodeBlock.Root title="JavaScript">
		<CodeBlock.Source code={data.code.protocol} />
	</CodeBlock.Root>

	<p>
		You choose a subscription's <Code.Root>id</Code.Root>; its events carry it.
		<Code.Root>where</Code.Root> is a
		<a href={resolve('/docs/platform/collections/filters')}>condition</a>, and <Code.Root
			>select</Code.Root
		> and <Code.Root>include</Code.Root> are arrays of field names, as in the
		<a href={resolve('/docs/api/records')}>records API</a>. The
		<a href={resolve('/docs/platform/collections/access-rules')}>view rule</a> decides which records you
		get events for, and app users don't get hidden fields.
	</p>

	<h2 id="messages">Messages</h2>

	<p>Every message is JSON with a <Code.Root>type</Code.Root>, and at most 32 KB:</p>

	<DocsTable head={['Type', 'From', 'Contents']} rows={messages} />

	<h2 id="events">Events</h2>

	<p>
		<Code.Root>action</Code.Root> is <Code.Root>create</Code.Root>, <Code.Root>update</Code.Root> or
		<Code.Root>delete</Code.Root>; <Code.Root>record</Code.Root> is as the records API returns it (for
		a delete, as it was); <Code.Root>at</Code.Root> is when it was saved, in milliseconds:
	</p>

	<CodeBlock.Root title="Event">
		<CodeBlock.Source code={data.code.event} />
	</CodeBlock.Root>

	<h2 id="errors">Errors and close codes</h2>

	<p>
		A refused message gets an <Code.Root>error</Code.Root>, with the subscription's
		<Code.Root>id</Code.Root> when it is about one:
	</p>

	<CodeBlock.Root title="Error">
		<CodeBlock.Source code={data.code.error} />
	</CodeBlock.Root>

	<DocsTable head={['Code', 'Means']} rows={errorCodes} />

	<p>The server closes the connection with these codes:</p>

	<DocsTable head={['Close code', 'Means']} rows={closeCodes} />
</DocsPage>
