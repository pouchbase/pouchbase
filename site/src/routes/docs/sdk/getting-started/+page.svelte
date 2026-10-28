<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'install', title: 'Install' },
		{ id: 'create-a-client', title: 'Create a client' },
		{ id: 'options', title: 'Options' },
		{ id: 'first-steps', title: 'First steps' },
		{ id: 'other-requests', title: 'Other requests' }
	];

	const options = [
		[
			'session',
			"Where the session is kept between page loads: 'memory' (the default), 'browser' (localStorage) or your own SessionStorage"
		],
		[
			'apiKey',
			'An API key (pbk_…) for server-side code; the client then acts as an admin, and pouch.mail and pouch.schema work'
		],
		['headers', 'Headers sent with every request'],
		[
			'fetch',
			'The fetch to use, for example to add retries or for tests; globalThis.fetch by default'
		],
		[
			'webSocket',
			'The WebSocket class for realtime, where there is no globalThis.WebSocket, such as ws'
		]
	];

	const services = [
		['pouch.auth', 'Register, login, OAuth, password resets and email verification'],
		['pouch.session', 'The signed-in user, and their token'],
		['pouch.db', 'The records of every collection'],
		['pouch.realtime', 'Changes to records as they happen'],
		['pouch.files', 'URLs of uploaded files and their thumbnails'],
		['pouch.functions', 'Calls to your functions'],
		['pouch.mail', 'Email templates, sent with an API key'],
		['pouch.schema', 'Collections, fields, indexes and rules, with an API key']
	];
</script>

<DocsPage
	title="Installation"
	description="Install @pouchbasejs/js-sdk, the TypeScript client for Pouchbase, create a client for your instance and make your first calls."
	{sections}
>
	<h2 id="install">Install</h2>

	<p>
		The SDK has no dependencies and runs wherever <Code.Root>fetch</Code.Root> exists: browsers, Node
		20 or later, Deno, Bun and Cloudflare Workers. You need a running instance; see
		<a href={resolve('/docs/platform/getting-started')}>Getting started</a>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.install} />
	</CodeBlock.Root>

	<h2 id="create-a-client">Create a client</h2>

	<p>
		Make one client and share it, for example from a module of its own. Pass the
		<a href={resolve('/docs/sdk/types')}>generated schema</a> to type your collections.
	</p>

	<CodeBlock.Root title="src/pouchbase-client.ts">
		<CodeBlock.Source code={data.code.client} />
	</CodeBlock.Root>

	<DocsTable head={['Property', 'For']} rows={services} />

	<h2 id="options">Options</h2>

	<DocsTable head={['Option', 'Meaning']} rows={options} />

	<p>
		See <a href="{resolve('/docs/sdk/authentication')}#session-storage">Session storage</a> and
		<a href={resolve('/docs/sdk/api-keys')}>API keys</a>.
	</p>

	<h2 id="first-steps">First steps</h2>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.firstSteps} />
	</CodeBlock.Root>

	<p>
		What the user may read and write is up to the
		<a href={resolve('/docs/platform/collections/access-rules')}>access rules</a> of each
		collection. A failed call throws a <Code.Root>PouchbaseError</Code.Root>; see
		<a href={resolve('/docs/sdk/errors')}>Errors</a>.
	</p>

	<h2 id="other-requests">Other requests</h2>

	<p>
		For an endpoint the SDK doesn't wrap, such as a plugin's route,
		<Code.Root>pouch.request()</Code.Root> calls any API path with the client's API key or session token,
		sends <Code.Root>body</Code.Root> as JSON and returns the parsed answer.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.otherRequests} />
	</CodeBlock.Root>
</DocsPage>
