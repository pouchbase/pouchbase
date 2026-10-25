<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	const sections: Section[] = [
		{ id: 'how-it-works', title: 'How it works' },
		{ id: 'what-you-receive', title: 'What you receive' },
		{ id: 'hosting', title: 'Hosting' }
	];
</script>

<DocsPage
	title="Realtime"
	description="Subscribe to the records of a collection and get every create, update and delete that the collection's view rule lets the user see, as it is saved, over a WebSocket."
	{sections}
>
	<h2 id="how-it-works">How it works</h2>

	<p>
		An app opens a WebSocket to Pouchbase, signs in with the user's token and subscribes to a
		collection, or to one record, optionally with a filter. Every create, update and delete that is
		saved through the records API then reaches it as an event, without polling. Subscribe:
	</p>

	<ul>
		<li>
			with TypeScript, with <a href={resolve('/docs/sdk/realtime')}
				><Code.Root>subscribe()</Code.Root></a
			> in the JS SDK;
		</li>
		<li>
			from any other language, over the <a href={resolve('/docs/api/realtime')}
				>WebSocket protocol</a
			>.
		</li>
	</ul>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:shield-check" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>The view rule decides</Callout.Title>
			<Callout.Description>
				A subscription needs a view rule other than Admins only, and only sends the records that
				rule lets the user see; see
				<a
					href={resolve('/docs/platform/collections/access-rules')}
					class="font-medium underline underline-offset-2">Access rules</a
				>.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="what-you-receive">What you receive</h2>

	<ul>
		<li>
			An event's record has the same shape as the records API returns it. For a delete, it is the
			record as it was.
		</li>
		<li>
			A record that no longer matches the view rule or your <Code.Root>where</Code.Root> after an update
			sends no event.
		</li>
		<li>
			The rule sees the signed-in user as they were when the connection was made, and is checked
			again on every reconnect.
		</li>
		<li>Changes made outside the database API, such as restoring a backup, send no events.</li>
		<li>
			The records grid in the dashboard subscribes too: it updates while you look at it, and shows <strong
				>Realtime</strong
			> in the top bar while connected.
		</li>
	</ul>

	<h2 id="hosting">Hosting</h2>

	<p>
		On Cloudflare Workers, every collection with subscribers has a Durable Object that holds its
		sockets. It is SQLite-backed, so the Free plan works too, and it hibernates while no events come
		in, so open sockets aren't billed for duration. On Docker and the single binary, the server
		holds the sockets itself.
	</p>

	<p>
		Behind a reverse proxy, let WebSocket upgrades through. Caddy does this by default; nginx needs
		<Code.Root>proxy_set_header Upgrade $http_upgrade</Code.Root> and
		<Code.Root>proxy_set_header Connection "upgrade"</Code.Root>.
	</p>
</DocsPage>
