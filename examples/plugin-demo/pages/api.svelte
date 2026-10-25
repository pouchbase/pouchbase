<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Callout from '@pouchbasejs/ui/callout';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Input from '@pouchbasejs/ui/inputs/input';
	import * as Textarea from '@pouchbasejs/ui/inputs/textarea';

	import CopyButton from '../components/copy-button.svelte';
	import PageHeader from '../components/page-header.svelte';
	import RouteCard from '../components/route-card.svelte';
	import { getJson, type Info } from '../lib/api.js';
	import { API_BASE, ROUTES, type RouteInfo } from '../lib/catalog.js';

	let { api }: PageProps = $props();

	// Plugin pages only run in the browser, so `location` is always there.
	const base = `${location.origin}${API_BASE}`;
	const info = $derived(getJson<Info>(api, '/info').catch(() => null));

	let message = $state('Hello from the API explorer');
	let itemId = $state('42');

	const route = (path: string) => ROUTES.find((item) => item.path === path) as RouteInfo;

	/** The JSON a string becomes in a shell command, between single quotes. */
	function quoted(value: string) {
		return `'${value.replaceAll("'", `'\\''`)}'`;
	}

	const echoBody = $derived(JSON.stringify({ message }));
</script>

<div class="flex flex-col gap-6">
	<PageHeader
		title="API explorer"
		description="Every route of the plugin. This page calls them with api.fetch, which sends your admin session; apps and scripts call them like any HTTP API."
	/>

	<div
		class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white py-2 pr-2 pl-4 shadow-xs"
	>
		<Icon.Root icon="lucide:globe" class="size-4 text-zinc-400" />
		<code class="min-w-0 flex-1 truncate font-mono text-sm text-zinc-700">{base}</code>
		<CopyButton text={base} label="Copy the base URL" />
	</div>

	<div class="flex flex-col gap-4">
		<RouteCard route={route('/info')} send={() => api.fetch('/info')} curl={`curl ${base}/info`} />

		<RouteCard
			route={route('/echo')}
			send={() =>
				api.fetch('/echo', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: echoBody
				})}
			curl={`curl -X POST ${base}/echo -H 'Content-Type: application/json' -d ${quoted(echoBody)}`}
		>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium text-zinc-500">Message</span>
				<Textarea.Root bind:value={message} class="font-mono" />
			</label>
			{#await info then current}
				{#if current}
					<p class="mt-2 text-xs text-zinc-500">
						At most {current.settings.max_length} characters, answered
						{current.settings.shout ? 'in capitals' : 'as sent'}: the
						<code class="font-mono">max_length</code> and <code class="font-mono">shout</code> settings.
					</p>
				{/if}
			{/await}
		</RouteCard>

		<RouteCard
			route={route('/items/:id')}
			send={() => api.fetch(`/items/${encodeURIComponent(itemId)}`)}
			curl={`curl ${base}/items/${encodeURIComponent(itemId)}`}
		>
			<label class="flex items-center gap-3">
				<span class="font-mono text-xs text-zinc-500">:id</span>
				<Input.Root bind:value={itemId} class="w-48 font-mono" aria-label="Item id" />
			</label>
		</RouteCard>

		<RouteCard
			route={route('/me')}
			send={() => api.fetch('/me')}
			curl={`curl ${base}/me -H 'Authorization: Bearer <token>'`}
		>
			<Callout.Root>
				<Callout.Icon><Icon.Root icon="lucide:user-round" /></Callout.Icon>
				<Callout.Body>
					<Callout.Description>
						Your admin session isn't an app user, so from here it answers 401. An app sends the
						token of a signed-in user, from <code class="font-mono text-xs">pouch.auth.login()</code
						>.
					</Callout.Description>
				</Callout.Body>
			</Callout.Root>
		</RouteCard>

		<RouteCard
			route={route('/github-status')}
			send={() => api.fetch('/github-status')}
			curl={`curl ${base}/github-status`}
		/>
	</div>
</div>
