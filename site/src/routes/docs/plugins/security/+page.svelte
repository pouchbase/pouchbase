<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	const sections: Section[] = [
		{ id: 'security-model', title: 'Security model' },
		{ id: 'limits', title: 'Limits' }
	];

	const limits = [
		{ limit: 'Bundle', value: '25 MiB: the manifest, server code and UI files together.' },
		{
			limit: 'Call time',
			value:
				'10 seconds for a field hook, a profile call or until a route’s response starts; then the call fails (502 for a route).'
		},
		{ limit: 'Field types', value: '20 per plugin.' },
		{ limit: 'Pages', value: '20 per plugin.' },
		{ limit: 'Sign-in providers', value: '10 per plugin.' },
		{ limit: 'Settings', value: '30 per plugin; keys of at most 63 characters.' },
		{ limit: 'Plugin id', value: '3 to 64 characters.' },
		{ limit: 'Field type name', value: 'At most 32 characters.' },
		{ limit: 'Icons', value: 'At most 32 KiB each, plain SVG.' },
		{
			limit: 'permissions.network',
			value:
				'At most 20 host names, such as api.example.com or *.example.com: no schemes, ports, paths, IP addresses or localhost.'
		},
		{
			limit: 'permissions.collections',
			value: 'At most 50 collection names (or *) for read and for write.'
		},
		{
			limit: 'Collections',
			value: '20 per plugin; the name with its prefix at most 63 characters.'
		},
		{ limit: 'Categories', value: 'At most 3.' }
	];
</script>

<DocsPage
	title="Security and limits"
	description="What a plugin can and can't do, and how large it may get."
	{sections}
>
	<h2 id="security-model">Security model</h2>

	<ul>
		<li>
			<strong>Routes are public.</strong> Anyone can call <Code.Root
				>/api/plugins/&lt;id&gt;/…</Code.Root
			>, from any origin (<Code.Root>Access-Control-Allow-Origin: *</Code.Root> unless the plugin sets
			its own CORS headers). Check <Code.Root>ctx.admin</Code.Root> or <Code.Root
				>ctx.user</Code.Root
			>
			yourself.
		</li>
		<li>
			<strong><Code.Root>ctx.admin</Code.Root></strong> needs an admin's session <em>and</em> a
			same-origin request, as <Code.Root>api.fetch</Code.Root> from a page makes, so another site can't
			act as the admin. The cookie never reaches the plugin.
		</li>
		<li>
			<strong><Code.Root>ctx.user</Code.Root></strong> comes from the bearer token. An invalid token
			gets a <Code.Root>401</Code.Root> before the plugin runs; API keys are not users.
		</li>
		<li>
			<strong>Responses are sandboxed</strong> with <Code.Root
				>Content-Security-Policy: sandbox</Code.Root
			>
			and <Code.Root>nosniff</Code.Root>, so HTML or SVG from a plugin runs no scripts on the
			dashboard's origin.
		</li>
		<li>
			<strong>Network.</strong>
			<Code.Root>fetch</Code.Root> and <Code.Root>WebSocket</Code.Root>
			only reach the HTTPS hosts in <Code.Root>permissions.network</Code.Root>, without following
			redirects. The server code can't import anything, so other Workers APIs, such as
			<Code.Root>cloudflare:sockets</Code.Root>, are out of reach.
		</li>
		<li>
			<strong>Data only through the records API.</strong> The plugin's Worker has no bindings to the
			database, the storage or Pouchbase's secrets. <Code.Root>ctx.pouch</Code.Root> uses a key of the
			plugin's own, renewed with every install and update, that only reaches the plugin's collections
			and those in <Code.Root>permissions.collections</Code.Root>, which the admin sees before
			installing (see <a href={resolve('/docs/plugins/collections')}>Collections</a>). API rules
			don't apply to it, so check <Code.Root>ctx.user</Code.Root> before acting for a user.
		</li>
		<li>
			<strong>Settings reach the Worker in plain text</strong>, secrets included: a
			<Code.Root>secret</Code.Root> is only hidden in the dashboard.
		</li>
		<li>
			<strong>Components run with the admin's privileges</strong> in the dashboard. Pouchbase compiles
			them itself and links only the provided modules, but a component can do anything the admin can:
			install only plugins you trust.
		</li>
	</ul>

	<h2 id="limits">Limits</h2>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>What</Table.Head>
				<Table.Head>Limit</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each limits as { limit, value } (limit)}
				<Table.Row>
					<Table.Cell class="whitespace-nowrap">{limit}</Table.Cell>
					<Table.Cell>{value}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		Plugin Workers also follow the
		<a href="https://developers.cloudflare.com/workers/platform/limits/"
			>limits of your Workers plan</a
		>, such as the size of the server code (3 MB compressed on Free, 10 MB on Paid), the CPU time
		per request and the number of Workers per account. On Pouchbase hosted on Workers, installing a
		plugin with many or large components can take more CPU time than the Free plan allows.
	</p>
</DocsPage>
