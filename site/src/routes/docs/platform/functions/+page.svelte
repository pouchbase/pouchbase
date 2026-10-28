<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'write-a-function', title: 'Write a function' },
		{ id: 'the-signed-in-user', title: 'The signed-in user' },
		{ id: 'secrets', title: 'Secrets and variables' },
		{ id: 'call-a-function', title: 'Call a function' },
		{ id: 'versions-logs-and-tests', title: 'Versions, logs and tests' },
		{ id: 'how-it-runs', title: 'How it runs' }
	];
</script>

<DocsPage
	title="Functions"
	description="Run your own server-side code next to Pouchbase: a function is a Cloudflare Worker that Pouchbase deploys for you and calls with the signed-in user."
	{sections}
>
	<h2 id="write-a-function">Write a function</h2>

	<p>
		Create functions on the <strong>Functions</strong> page of the dashboard. A function is one ES
		module whose default export has a <Code.Root>fetch(request, env, ctx)</Code.Root> handler, like a
		Cloudflare Worker. Write TypeScript or JavaScript in the editor, or upload a
		<Code.Root>.ts</Code.Root> or <Code.Root>.js</Code.Root> file. A new function starts with:
	</p>

	<CodeBlock.Root title="function.ts">
		<CodeBlock.Source code={data.code.handler} />
	</CodeBlock.Root>

	<p>
		Names are lowercase letters, digits and dashes, at most 40 characters; the code is at most 1 MB.
		To use npm packages, bundle them into one file and upload that:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.bundle} />
	</CodeBlock.Root>

	<h2 id="the-signed-in-user">The signed-in user</h2>

	<p>
		Pouchbase checks the caller's token before the request reaches the function.
		<Code.Root>pouchbaseUser(request)</Code.Root> returns the user, as
		<Code.Root>GET /api/auth/me</Code.Root> does, or <Code.Root>null</Code.Root> without a valid token.
		A function set to require sign-in answers <Code.Root>401</Code.Root> to those requests without running.
	</p>

	<h2 id="secrets">Secrets and variables</h2>

	<p>
		Set secrets on the <strong>Secrets</strong> tab. Cloudflare stores them encrypted on the
		function's Worker, and the code reads them from <Code.Root>env</Code.Root>. Names are upper-case
		letters, digits and underscores. Pouchbase sets <Code.Root>env.POUCHBASE_URL</Code.Root>, the
		URL of the installation, and <Code.Root>env.POUCHBASE_API_KEY</Code.Root>, an
		<a href={resolve('/docs/platform/api-keys')}>API key</a> renewed on every deploy, for example to
		<a href={resolve('/docs/platform/email')}>send email</a>.
	</p>

	<h2 id="call-a-function">Call a function</h2>

	<p>
		Apps call a function at <Code.Root>/api/functions/&lt;name&gt;</Code.Root>, with the user's
		token. The method, headers, body, and the rest of the path and query string are passed on, so
		one function can serve a small API. Calls from servers, such as webhooks, and JSON requests from
		browsers work; browsers on other sites can't post HTML forms to a function.
	</p>

	<ul>
		<li>
			With TypeScript, call it with <a href={resolve('/docs/sdk/functions')}
				><Code.Root>pouch.functions.invoke()</Code.Root></a
			>.
		</li>
		<li>
			From anywhere else, send the request yourself; see
			<a href={resolve('/docs/api/functions')}>Functions</a> in the REST API.
		</li>
	</ul>

	<h2 id="versions-logs-and-tests">Versions, logs and tests</h2>

	<ul>
		<li>Every deploy is kept as a version, and an earlier version can be restored.</li>
		<li>
			The <strong>Test</strong> tab sends requests to the deployed version, without a user:
			<Code.Root>pouchbaseUser(request)</Code.Root> returns <Code.Root>null</Code.Root>.
		</li>
		<li>
			The <strong>Logs</strong> tab shows Workers Logs; the instance's API token needs Workers Observability
			(Edit) for it.
		</li>
	</ul>

	<h2 id="how-it-runs">How it runs</h2>

	<p>
		Every deploy uploads the code as a Worker of its own on the same Cloudflare account,
		<Code.Root>&lt;instance&gt;-fn-&lt;name&gt;</Code.Root> (<Code.Root
			>pouchbase-fn-hello</Code.Root
		>
		by default). So functions run on Cloudflare however you host Pouchbase, with the limits and pricing
		of your Workers plan.
	</p>

	<p>
		The Worker answers on its <Code.Root>workers.dev</Code.Root> URL only to requests with the function's
		secret, which only Pouchbase knows. The account needs a
		<Code.Root>workers.dev</Code.Root> subdomain; open Workers &amp; Pages in the Cloudflare dashboard
		once to get one.
	</p>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:shield" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>HTML from a function can't run scripts</Callout.Title>
			<Callout.Description>
				Answers come from the domain of your Pouchbase admin, so they get
				<Code.Root>Content-Security-Policy: sandbox</Code.Root>. Serve pages with scripts from your
				own app.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>
</DocsPage>
