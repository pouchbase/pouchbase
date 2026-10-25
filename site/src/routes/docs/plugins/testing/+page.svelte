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
			message: 'The plugin’s UI components could not be compiled',
			about: 'A component doesn’t compile; each problem is listed as file:line:column.'
		},
		{
			message: 'The plugin’s bundle is not valid',
			about: 'The bundle breaks a rule of the manifest or the bundle format.'
		},
		{
			message: 'The plugin’s server code did not answer as expected',
			about: 'The deployed server code failed when Pouchbase asked what it contributes.'
		},
		{
			message: 'The sign-in provider <id> already comes from the plugin <plugin>',
			about: 'Provider ids are global; rename yours.'
		},
		{
			message: 'This plugin has no version that this Pouchbase can install',
			about: 'No published version has an engines.pouchbase range this Pouchbase satisfies.'
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
		<Code.Root>pnpm dev</Code.Root> (<Code.Root>pouchbase-plugin dev</Code.Root>) rebuilds the
		plugin on every change and serves it from a local registry on <Code.Root
			>http://localhost:4510</Code.Root
		>. Point a Pouchbase on the same machine at it:
	</p>

	<CodeBlock.Root title=".env">
		<CodeBlock.Source code={data.code.devRegistry} />
	</CodeBlock.Root>

	<p>
		That Pouchbase can be the <a href={resolve('/docs/getting-started/docker')}>Docker image</a>,
		the
		<a href={resolve('/docs/getting-started/single-binary')}>single binary</a> or, if you work on Pouchbase
		itself, a clone of the repository:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.devInRepo} />
	</CodeBlock.Root>

	<ul>
		<li>
			Install the plugin from the <strong>Plugins</strong> page. Every build is served as a new
			prerelease (<Code.Root>1.2.0-dev.3</Code.Root>), so click <strong>Update</strong> after a change.
		</li>
		<li>
			Server code is deployed as a Worker on your Cloudflare account, so that Pouchbase needs its
			usual <Code.Root>CLOUDFLARE_ACCOUNT_ID</Code.Root> and <Code.Root
				>CLOUDFLARE_API_TOKEN</Code.Root
			>.
		</li>
		<li>
			A Pouchbase on Cloudflare or another server can't reach <Code.Root>localhost</Code.Root>: to
			try a build there, <a href={resolve('/docs/plugins/publishing')}>publish</a> it to a registry it
			can reach.
		</li>
	</ul>

	<h2 id="unit-tests">Unit tests</h2>

	<p>
		Field hooks, sign-in providers and routes are plain functions, so test them in Node.js, straight
		from the plugin: <Code.Root>plugin.routes['/stats'].GET</Code.Root>,
		<Code.Root>plugin.fields.color.validate</Code.Root> or
		<Code.Root>plugin.authProviders.gitlab.profile</Code.Root>, typed by
		<Code.Root>definePlugin</Code.Root>. Since <Code.Root>plugin.ts</Code.Root> imports
		<Code.Root>.svelte</Code.Root> and <Code.Root>.svg</Code.Root> files, the templates'
		<Code.Root>vitest.config.ts</Code.Root> adds the SDK's Vite plugin, which turns those imports into
		references to the files, as a build does:
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
			<Code.Root>"POST https://…"</Code.Root>), and <Code.Root>requests</Code.Root> lists what it was
			asked. Like Pouchbase, it throws for a host outside <Code.Root>permissions.network</Code.Root
			>.
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
		Components need the dashboard to run: try them with <a href="#run-in-pouchbase"
			><Code.Root>pnpm dev</Code.Root></a
		>.
	</p>

	<h2 id="check-before-installing">Check before installing</h2>

	<p>Every template has these scripts:</p>

	<ul>
		<li><Code.Root>pnpm test</Code.Root>: the tests, with Vitest.</li>
		<li>
			<Code.Root>pnpm check</Code.Root>: type-checks the TypeScript and the components with
			<Code.Root>svelte-check</Code.Root>.
		</li>
		<li>
			<Code.Root>pnpm validate</Code.Root>: applies the same rules as Pouchbase does on install and
			compiles every component, so it catches what would make the install fail. Each error names the
			file and how to fix it.
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
					The logs of the plugin's Worker, <Code.Root>&lt;instance&gt;-plugin-&lt;id&gt;</Code.Root
					>, under
					<strong>Workers &amp; Pages</strong> in the Cloudflare dashboard or live with
					<Code.Root>wrangler tail</Code.Root>: <Code.Root>ctx.log</Code.Root>,
					<Code.Root>console</Code.Root> and uncaught errors.
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
		The status codes Pouchbase answers for a route are listed under
		<a href="{resolve('/docs/plugins/routes')}#status-codes">Routes</a>.
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
