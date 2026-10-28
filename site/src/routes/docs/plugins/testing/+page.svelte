<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'run-in-pouchbase', title: 'Run in Pouchbase' },
		{ id: 'unit-tests', title: 'Unit tests' },
		{ id: 'check-before-installing', title: 'Check before installing' },
		{ id: 'logs', title: 'Logs' },
		{ id: 'install-errors', title: 'Install errors' }
	];

	const installErrors = [
		{
			message: 'The plugin registry can’t be reached',
			about: 'Check POUCHBASE_REGISTRY_URL, and that the registry (or pnpm dev) is running.'
		},
		{
			message: 'This plugin has no version that this Pouchbase can install',
			about: 'No published version has an engines.pouchbase range this Pouchbase satisfies.'
		},
		{
			message: 'The plugin’s bundle is not valid',
			about: 'The bundle breaks a rule of the manifest or the bundle format; the first one follows.'
		},
		{
			message: 'The plugin’s components could not be compiled',
			about: 'The first problems follow as file:line:column.'
		},
		{
			message: 'The Cloudflare account has no workers.dev subdomain yet',
			about:
				'Open Workers & Pages in the Cloudflare dashboard once to choose a subdomain, then install again.'
		},
		{
			message: 'The plugin’s Worker could not be deployed',
			about:
				'Cloudflare refused the Worker, e.g. a token without permission to edit Workers, or the account’s Worker limit.'
		},
		{
			message: 'The plugin’s server code did not answer as expected',
			about: 'The server code failed when Pouchbase asked what it contributes.'
		},
		{
			message: 'The sign-in provider <id> already comes from the plugin <plugin>',
			about: 'Provider ids are global; rename yours.'
		}
	];
</script>

<DocsPage
	title="Testing and debugging"
	description="Try a plugin in your own Pouchbase while you work on it, test its server code with any test runner, and find out why something fails."
	{sections}
>
	<h2 id="run-in-pouchbase">Run in Pouchbase</h2>

	<p>
		<Code.Root>pnpm dev</Code.Root> rebuilds the plugin on every change and serves it from a local registry
		on <Code.Root>http://localhost:4510</Code.Root>. Point a Pouchbase on the same machine at it:
	</p>

	<CodeBlock.Root title=".env">
		<CodeBlock.Source code={data.code.devRegistry} />
	</CodeBlock.Root>

	<p>
		That can be the <a href={resolve('/docs/platform/getting-started/docker')}>Docker image</a>, the
		<a href={resolve('/docs/platform/getting-started/single-binary')}>single binary</a> or a clone of
		the Pouchbase repository:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.devInRepo} />
	</CodeBlock.Root>

	<ul>
		<li>
			Install the plugin from the <strong>Plugins</strong> page. Every build is a new prerelease (<Code.Root
				>1.2.0-dev.3</Code.Root
			>): click <strong>Update</strong> after a change.
		</li>
		<li>
			In a repository clone, the server code runs inside Pouchbase, without a Worker or its sandbox,
			and <Code.Root>engines.pouchbase</Code.Root> isn't checked.
		</li>
		<li>
			The Docker image and the single binary deploy it as a Worker on your Cloudflare account, so
			they need <Code.Root>CLOUDFLARE_ACCOUNT_ID</Code.Root> and
			<Code.Root>CLOUDFLARE_API_TOKEN</Code.Root>. That Worker can't reach a Pouchbase on
			<Code.Root>localhost</Code.Root>, so <Code.Root>ctx.pouch</Code.Root> fails there.
		</li>
		<li>
			A Pouchbase on Cloudflare or another server can't reach your <Code.Root>localhost</Code.Root>:
			<a href={resolve('/docs/plugins/publishing')}>publish</a> to a registry it can reach.
		</li>
	</ul>

	<h2 id="unit-tests">Unit tests</h2>

	<p>
		Field hooks, sign-in providers and routes are plain functions: call them straight from the
		plugin, typed by <Code.Root>definePlugin</Code.Root>, e.g.
		<Code.Root>plugin.routes['/stats'].GET</Code.Root> or
		<Code.Root>plugin.fields.color.validate</Code.Root>. The templates'
		<Code.Root>vitest.config.ts</Code.Root> adds the SDK's Vite plugin, which turns the
		<Code.Root>.svelte</Code.Root> and <Code.Root>.svg</Code.Root> imports of
		<Code.Root>plugin.ts</Code.Root> into file references, as a build does:
	</p>

	<CodeBlock.Root title="vitest.config.ts">
		<CodeBlock.Source code={data.code.vitestConfig} />
	</CodeBlock.Root>

	<p>
		<Code.Root>fakeContext</Code.Root> from <Code.Root>@pouchbasejs/plugin-sdk/testing</Code.Root>
		builds the <Code.Root>ctx</Code.Root> Pouchbase would pass:
	</p>

	<ul>
		<li>
			<Code.Root>responses</Code.Root> answers <Code.Root>ctx.fetch</Code.Root> by URL (or
			<Code.Root>"POST https://…"</Code.Root>), other URLs get a <Code.Root>404</Code.Root>;
			<Code.Root>requests</Code.Root> lists what was fetched. Like Pouchbase, it throws for a host outside
			the <Code.Root>manifest</Code.Root>'s <Code.Root>permissions.network</Code.Root>.
		</li>
		<li>
			<Code.Root>settings</Code.Root> are the saved values, as strings, parsed by the definitions in
			<Code.Root>plugin</Code.Root>.
		</li>
		<li>
			<Code.Root>admin</Code.Root>, <Code.Root>user</Code.Root> and <Code.Root>params</Code.Root> set
			the rest; <Code.Root>logs</Code.Root> collects what <Code.Root>ctx.log</Code.Root> wrote.
		</li>
		<li>
			<Code.Root>pouch</Code.Root> is <Code.Root>ctx.pouch</Code.Root>, usually
			<Code.Root>fakePouch(…).client</Code.Root> (see
			<a href="{resolve('/docs/plugins/collections')}#testing">Collections</a>); without it,
			<Code.Root>ctx.pouch</Code.Root> fails.
		</li>
	</ul>

	<CodeBlock.Root title="test/routes.test.ts">
		<CodeBlock.Source code={data.code.testRoute} />
	</CodeBlock.Root>

	<CodeBlock.Root title="test/color.test.ts">
		<CodeBlock.Source code={data.code.testField} />
	</CodeBlock.Root>

	<CodeBlock.Root title="test/settings.test.ts">
		<CodeBlock.Source code={data.code.testSettings} />
	</CodeBlock.Root>

	<p>
		Components need the dashboard: try them with <a href="#run-in-pouchbase"
			><Code.Root>pnpm dev</Code.Root></a
		>.
	</p>

	<h2 id="check-before-installing">Check before installing</h2>

	<ul>
		<li><Code.Root>pnpm test</Code.Root> runs the tests with Vitest.</li>
		<li>
			<Code.Root>pnpm check</Code.Root> type-checks the TypeScript and the components with
			<Code.Root>svelte-check</Code.Root>.
		</li>
		<li>
			<Code.Root>pnpm validate</Code.Root> applies the rules Pouchbase applies on install and compiles
			every component, naming the file of each error.
		</li>
	</ul>

	<h2 id="logs">Logs</h2>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>What</Table.Head>
				<Table.Head>Where to look</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			<Table.Row>
				<Table.Cell>Server code</Table.Cell>
				<Table.Cell>
					The plugin's Worker, <Code.Root>&lt;instance&gt;-plugin-&lt;id&gt;</Code.Root>, under
					<strong>Workers &amp; Pages</strong> in the Cloudflare dashboard or live with
					<Code.Root>wrangler tail</Code.Root>: <Code.Root>ctx.log</Code.Root>,
					<Code.Root>console</Code.Root> and uncaught errors. In a repository clone, the terminal.
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell>Why a route failed</Table.Cell>
				<Table.Cell>
					The Pouchbase log (the terminal, <Code.Root>docker logs</Code.Root> or the Pouchbase Worker's
					logs). The caller only gets a <Code.Root>502</Code.Root>.
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell>Components</Table.Cell>
				<Table.Cell>
					The browser's developer console, starting with
					<Code.Root>[plugins] &lt;plugin&gt; failed</Code.Root>.
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell>Built-in plugins</Table.Cell>
				<Table.Cell>The Pouchbase log: they run inside Pouchbase.</Table.Cell>
			</Table.Row>
		</Table.Body>
	</Table.Root>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.debugLogs} />
	</CodeBlock.Root>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.routeErrors} />
	</CodeBlock.Root>

	<p>
		See <a href="{resolve('/docs/plugins/routes')}#status-codes">Routes</a> for the status codes Pouchbase
		answers for a route.
	</p>

	<h2 id="install-errors">Install errors</h2>

	<p>When an install fails, the dashboard says why:</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Message</Table.Head>
				<Table.Head>What to do</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each installErrors as { message, about } (message)}
				<Table.Row>
					<Table.Cell>{message}</Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</DocsPage>
