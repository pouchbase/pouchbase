<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	const sections: Section[] = [
		{ id: 'security-model', title: 'Security model' },
		{ id: 'limits', title: 'Limits' }
	];

	const limits = [
		{ limit: 'Bundle', value: '1 MiB: the manifest, server code and UI files together.' },
		{
			limit: 'Call time',
			value:
				'10 seconds for a field hook, a profile call or until a route’s response starts; then the call fails (502 for a route).'
		},
		{ limit: 'Field types', value: '20 per plugin.' },
		{ limit: 'Pages', value: '20 per plugin.' },
		{ limit: 'Sign-in providers', value: '10 per plugin.' },
		{ limit: 'Settings', value: '30 per plugin; keys of at most 63 characters.' },
		{ limit: 'Plugin id', value: 'At most 64 characters.' },
		{ limit: 'Field type name', value: 'At most 32 characters.' },
		{ limit: 'Icons', value: 'At most 32 KiB each, plain SVG.' },
		{
			limit: 'permissions.network',
			value:
				'At most 20 host names, such as api.example.com or *.example.com: no schemes, ports, paths, IP addresses or localhost.'
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
			>, from any origin: responses carry <Code.Root>Access-Control-Allow-Origin: *</Code.Root> unless
			the plugin sets its own CORS headers. Check <Code.Root>ctx.admin</Code.Root> or
			<Code.Root>ctx.user</Code.Root> yourself.
		</li>
		<li>
			<strong><Code.Root>ctx.admin</Code.Root></strong> needs an admin's session <em>and</em> a
			same-origin request, as <Code.Root>api.fetch</Code.Root> from a page makes, so another site can't
			act as the admin. The admin's cookie never reaches the plugin.
		</li>
		<li>
			<strong><Code.Root>ctx.user</Code.Root></strong> comes from the bearer token. An invalid token
			gets a <Code.Root>401</Code.Root> before the plugin runs; API keys are not users.
		</li>
		<li>
			<strong>Responses are sandboxed.</strong> Pouchbase adds
			<Code.Root>Content-Security-Policy: sandbox</Code.Root> and <Code.Root>nosniff</Code.Root>, so
			HTML or SVG from a plugin runs no scripts on the dashboard's origin.
		</li>
		<li>
			<strong>Network.</strong> Server code only reaches the HTTPS hosts in
			<Code.Root>permissions.network</Code.Root>, through <Code.Root>fetch</Code.Root> and
			<Code.Root>WebSocket</Code.Root>, and redirects aren't followed. Other Workers APIs, such as
			<Code.Root>cloudflare:sockets</Code.Root>, aren't available.
		</li>
		<li>
			<strong>No access to Pouchbase.</strong> The plugin's Worker has no bindings: it can't read the
			database, storage or Pouchbase's secrets. It only gets the data of each call.
		</li>
		<li>
			<strong>Settings reach the Worker in plain text</strong>, secrets included, because the plugin
			needs them. A <Code.Root>secret</Code.Root> is only hidden in the dashboard.
		</li>
		<li>
			<strong>Components run with the admin's privileges</strong> in the dashboard. Pouchbase compiles
			them itself and links only the provided modules, but a component can do anything the admin can.
			Install only plugins you trust.
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
		Plugin Workers also follow the limits of your Cloudflare Workers plan, such as the CPU time per
		request and the number of Workers per account. On Pouchbase hosted on Workers, installing a
		plugin with many or large components can take more CPU time than the Free plan allows; see
		<a href="https://developers.cloudflare.com/workers/platform/limits/"
			>Cloudflare's Workers limits</a
		>.
	</p>
</DocsPage>
