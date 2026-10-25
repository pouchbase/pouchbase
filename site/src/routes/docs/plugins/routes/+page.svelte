<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'a-route', title: 'A route' },
		{ id: 'params', title: 'Params' },
		{ id: 'users-and-admins', title: 'Users and admins' },
		{ id: 'the-context', title: 'The context' },
		{ id: 'server-code', title: 'Server code' },
		{ id: 'status-codes', title: 'Status codes' }
	];

	const context = [
		{ member: 'ctx.plugin', about: 'The plugin’s id and version.' },
		{
			member: 'ctx.settings.get(key)',
			about:
				'A promise of a setting, parsed by its type; ctx.settings.getAll() gives them all. See Settings.'
		},
		{ member: 'ctx.fetch', about: 'fetch, limited to the hosts in permissions.network.' },
		{
			member: 'ctx.pouch',
			about:
				'The JS SDK, signed in as the plugin: records of its own collections and those in permissions.collections. See Collections.'
		},
		{
			member: 'ctx.log',
			about: 'info, warn and error, written to the log of the plugin’s Worker.'
		},
		{
			member: 'ctx.admin',
			about: 'true only for a request from an admin signed in to the dashboard.'
		},
		{
			member: 'ctx.user',
			about:
				'The app user of the request’s bearer token (id, email, name, verified, avatar, …; never passwords or tokens), or null.'
		},
		{
			member: 'ctx.params',
			about: 'The :name segments of the route’s path, e.g. { id: "42" } for /items/:id.'
		}
	];

	const statuses = [
		{
			status: '401',
			about:
				'The bearer token isn’t a valid app user token. Pouchbase answers before the plugin runs.'
		},
		{
			status: '404',
			about:
				'No route of the plugin answers the path (Route not found), or the plugin isn’t installed (Plugin not found).'
		},
		{
			status: '405',
			about:
				'The path exists, but has no handler for this method; the Allow header lists the ones it has.'
		},
		{
			status: '500',
			about: 'Pouchbase couldn’t load the installed plugin. The reason is in the Pouchbase log.'
		},
		{
			status: '502',
			about:
				'The handler threw, returned no Response, its Worker couldn’t be reached or didn’t answer within 10 seconds. The reason is only in the Pouchbase log.'
		}
	];
</script>

<DocsPage
	title="Routes"
	description="Add HTTP endpoints under /api/plugins/<id>/, for the plugin's own pages, your apps and webhooks."
	{sections}
>
	<h2 id="a-route">A route</h2>

	<p>
		Routes are the <Code.Root>routes</Code.Root> of <Code.Root>definePlugin</Code.Root>, by path.
		Each has a handler per HTTP method it answers: <Code.Root>GET</Code.Root>,
		<Code.Root>POST</Code.Root>, <Code.Root>PUT</Code.Root>, <Code.Root>PATCH</Code.Root> or
		<Code.Root>DELETE</Code.Root>. A module that exports them, imported with
		<Code.Root>import * as</Code.Root>, is one; its other exports are left alone. A path answers at
		<Code.Root>/api/plugins/&lt;plugin&gt;&lt;path&gt;</Code.Root>, and <Code.Root>'/'</Code.Root>
		is the plugin's root.
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.routesPlugin} />
	</CodeBlock.Root>

	<p>From the demo plugin:</p>

	<CodeBlock.Root title="routes/info.ts">
		<CodeBlock.Source code={data.code.route} />
	</CodeBlock.Root>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.routeCurl} />
	</CodeBlock.Root>

	<h2 id="params">Params</h2>

	<p>
		<Code.Root>:name</Code.Root> in a path is a param, in <Code.Root>ctx.params</Code.Root>. A
		static segment wins over a param: <Code.Root>/items/new</Code.Root> goes to
		<Code.Root>'/items/new'</Code.Root> before <Code.Root>'/items/:id'</Code.Root>. The file name
		doesn't matter: the demo registers <Code.Root>routes/item.ts</Code.Root> at
		<Code.Root>'/items/:id'</Code.Root>.
	</p>

	<CodeBlock.Root title="routes/item.ts">
		<CodeBlock.Source code={data.code.routeParams} />
	</CodeBlock.Root>

	<h2 id="users-and-admins">Users and admins</h2>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:shield-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Routes are public</Callout.Title>
			<Callout.Description>
				Anyone can call them, from any origin. Check <Code.Root>ctx.admin</Code.Root> or
				<Code.Root>ctx.user</Code.Root> before doing anything that needs either. See the
				<a href={resolve('/docs/plugins/security')}>security model</a>.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<ul>
		<li>
			<Code.Root>ctx.admin</Code.Root> is <Code.Root>true</Code.Root> for requests from the plugin's
			<a href={resolve('/docs/plugins/pages')}>pages</a> through <Code.Root>api.fetch</Code.Root>.
		</li>
		<li>
			<Code.Root>ctx.user</Code.Root> is the app user of the request's
			<Code.Root>Authorization: Bearer &lt;token&gt;</Code.Root>, or <Code.Root>null</Code.Root>:
		</li>
	</ul>

	<CodeBlock.Root title="routes/me.ts">
		<CodeBlock.Source code={data.code.routeUser} />
	</CodeBlock.Root>

	<h2 id="the-context">The context</h2>

	<p>
		Every handler, of a route, a field type or a sign-in provider, gets <Code.Root>ctx</Code.Root>:
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Member</Table.Head>
				<Table.Head>What it is</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each context as { member, about } (member)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{member}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		<Code.Root>ctx.admin</Code.Root>, <Code.Root>ctx.user</Code.Root> and
		<Code.Root>ctx.params</Code.Root> are only set in routes.
	</p>

	<h2 id="server-code">Server code</h2>

	<p>
		The handlers of routes, field types and sign-in providers are bundled into one module that runs
		in its own Worker on your Cloudflare account; their components and icons stay out of it. In that
		Worker:
	</p>

	<ul>
		<li>
			Only the HTTPS hosts in <Code.Root>permissions.network</Code.Root> are reachable, through
			<Code.Root>ctx.fetch</Code.Root> or the global <Code.Root>fetch</Code.Root> and
			<Code.Root>WebSocket</Code.Root>. Redirects are returned, not followed.
		</li>
		<li>
			There are no bindings: no database, storage or secrets other than the plugin's settings.
		</li>
		<li>
			npm packages the server code imports are bundled in, so install them as dependencies.
			<Code.Root>cloudflare:*</Code.Root> and <Code.Root>node:*</Code.Root> modules aren't available.
		</li>
	</ul>

	<CodeBlock.Root title="routes/github-status.ts">
		<CodeBlock.Source code={data.code.outsideApi} />
	</CodeBlock.Root>

	<h2 id="status-codes">Status codes</h2>

	<p>
		A route's response reaches the caller as the route returns it. Pouchbase answers these itself,
		with a JSON <Code.Root>message</Code.Root>:
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Status</Table.Head>
				<Table.Head>Means</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each statuses as { status, about } (status)}
				<Table.Row>
					<Table.Cell><Code.Root>{status}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		Paths below <Code.Root>/assets</Code.Root> and <Code.Root>/modules</Code.Root> belong to Pouchbase,
		which serves the plugin's images and components there.
	</p>
</DocsPage>
