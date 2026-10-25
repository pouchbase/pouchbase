<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Badge from '@pouchbasejs/ui/badge';
	import * as Button from '@pouchbasejs/ui/button';
	import * as Callout from '@pouchbasejs/ui/callout';
	import * as Card from '@pouchbasejs/ui/card';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Link from '@pouchbasejs/ui/link';
	import * as Skeleton from '@pouchbasejs/ui/skeleton';
	import * as Tile from '@pouchbasejs/ui/tile';

	import FieldPreview from '../components/field-preview.svelte';
	import PageHeader from '../components/page-header.svelte';
	import Section from '../components/section.svelte';
	import StatusDot, { type Status } from '../components/status-dot.svelte';
	import { getJson, type GitHubStatus, type Info } from '../lib/api.js';
	import { FIELD_TYPE_LIST, PAGES, ROUTES, pageHref } from '../lib/catalog.js';

	let { params, api }: PageProps = $props();

	const info = $derived(getJson<Info>(api, '/info'));

	// Starts with a check; the refresh button checks again.
	let github = $derived(getJson<GitHubStatus>(api, '/github-status'));
	let checkedAt = $state(new Date());

	function checkGitHub() {
		github = getJson<GitHubStatus>(api, '/github-status');
		checkedAt = new Date();

		return github.catch(() => {});
	}

	const GITHUB_STATUS: Record<GitHubStatus['indicator'], Status> = {
		none: 'ok',
		minor: 'warning',
		major: 'error',
		critical: 'error'
	};

	const SETTING_TYPES: Record<string, string> = {
		greeting: 'text',
		max_length: 'number',
		shout: 'boolean'
	};
</script>

<div class="flex flex-col gap-8">
	<PageHeader
		title="Demo plugin"
		description="A tour of everything a Pouchbase plugin can add: field types for collections, pages like this one, HTTP routes and settings. Every part of it is in examples/plugin-demo, ready to copy."
	>
		{#snippet eyebrow()}
			<Badge.Root variant="outline">Example plugin</Badge.Root>
			{#await info then { version }}
				<Badge.Root>v{version}</Badge.Root>
			{/await}
		{/snippet}

		{#snippet actions()}
			<Button.Root variant="secondary" href={pageHref('fields')}>Field playground</Button.Root>
			<Button.Root href={pageHref('api')}>
				<Icon.Root icon="lucide:code" />
				API explorer
			</Button.Root>
		{/snippet}
	</PageHeader>

	<!-- The greeting comes from a setting, read by GET /info; ctx.admin says who asked. -->
	<div
		class="relative overflow-hidden rounded-xl border border-orange-200/70 bg-linear-to-br from-orange-50 via-amber-50/40 to-white p-6"
	>
		<div
			class="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-orange-200/40 blur-3xl"
			aria-hidden="true"
		></div>

		<div class="relative flex flex-wrap items-center justify-between gap-6">
			<div class="flex max-w-lg flex-col gap-2">
				{#await info}
					<Skeleton.Root class="h-7 w-48" />
					<Skeleton.Root class="h-4 w-80" />
				{:then { greeting, admin }}
					<p class="text-xl font-semibold text-zinc-900">{greeting}, and welcome to the demo.</p>
					<p class="text-sm/6 text-zinc-600">
						That greeting is the plugin's <code class="font-mono text-[13px]">greeting</code>
						setting, read by <code class="font-mono text-[13px]">GET /info</code>.
						{admin
							? 'This page sends your admin session, so the route sees ctx.admin as true.'
							: 'The route did not see an admin session.'}
					</p>
				{:catch error}
					<Callout.Root variant="error">{error.message}</Callout.Root>
				{/await}
			</div>

			<!-- The field types' own previews, as the records grid shows them. -->
			<div
				class="flex flex-col gap-2.5 rounded-lg border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur"
				aria-label="Field previews"
			>
				<FieldPreview type="color" value="#f97316" />
				<FieldPreview type="rating" value={4} />
				<FieldPreview type="phone" value="+31612345678" />
			</div>
		</div>
	</div>

	<Tile.Grid>
		<Tile.Root>
			<Tile.Header>
				<Tile.Icon><Icon.Root icon="lucide:puzzle" /></Tile.Icon>
				<Tile.Title>Field types</Tile.Title>
			</Tile.Header>
			<Tile.Value>{FIELD_TYPE_LIST.length}</Tile.Value>
			<Tile.Description>{FIELD_TYPE_LIST.map((type) => type.label).join(', ')}</Tile.Description>
		</Tile.Root>
		<Tile.Root>
			<Tile.Header>
				<Tile.Icon><Icon.Root icon="lucide:layout-dashboard" /></Tile.Icon>
				<Tile.Title>Pages</Tile.Title>
			</Tile.Header>
			<Tile.Value>{PAGES.length}</Tile.Value>
			<Tile.Description>Linked in the sidebar under Plugins</Tile.Description>
		</Tile.Root>
		<Tile.Root>
			<Tile.Header>
				<Tile.Icon><Icon.Root icon="lucide:code" /></Tile.Icon>
				<Tile.Title>Routes</Tile.Title>
			</Tile.Header>
			<Tile.Value>{ROUTES.length}</Tile.Value>
			<Tile.Description>Under /api/plugins/demo</Tile.Description>
		</Tile.Root>
		<Tile.Root>
			<Tile.Header>
				<Tile.Icon><Icon.Root icon="lucide:sliders-horizontal" /></Tile.Icon>
				<Tile.Title>Settings</Tile.Title>
			</Tile.Header>
			<Tile.Value>{Object.keys(SETTING_TYPES).length}</Tile.Value>
			<Tile.Description>Typed, with defaults</Tile.Description>
		</Tile.Root>
	</Tile.Grid>

	<Section
		title="Field types"
		description="Add them to a collection like the built-in types. Each one has an input for the record form and a preview for the records grid."
	>
		{#snippet action()}
			<Link.Root href={pageHref('fields')} class="text-sm">Try them in the playground →</Link.Root>
		{/snippet}

		<div class="grid gap-4 sm:grid-cols-3">
			{#each FIELD_TYPE_LIST as type (type.type)}
				<Card.Root class="flex flex-col overflow-hidden">
					<div
						class="flex h-24 flex-col items-center justify-center gap-2 border-b border-zinc-100 bg-zinc-50 bg-[radial-gradient(var(--color-zinc-200)_1px,transparent_1px)] bg-size-[12px_12px]"
					>
						{#each type.samples as sample (sample)}
							<FieldPreview type={type.type} value={sample} />
						{/each}
					</div>
					<div class="flex flex-col gap-1.5 p-4">
						<div class="flex items-center justify-between gap-2">
							<h3 class="text-sm font-semibold text-zinc-900">{type.label}</h3>
							<code class="font-mono text-xs text-zinc-400">demo:{type.type}</code>
						</div>
						<p class="text-sm text-zinc-500">{type.description}</p>
					</div>
				</Card.Root>
			{/each}
		</div>
	</Section>

	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Settings</Card.Title>
				<Card.Description>
					An admin changes them on the <Link.Root href="/plugins">Plugins</Link.Root> page; routes read
					them, typed, with <code class="font-mono text-xs">ctx.settings</code>.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#await info}
					<div class="flex flex-col gap-2">
						<Skeleton.Root class="h-5 w-full" />
						<Skeleton.Root class="h-5 w-full" />
						<Skeleton.Root class="h-5 w-full" />
					</div>
				{:then { settings }}
					<dl class="divide-y divide-zinc-100 text-sm">
						{#each Object.entries(settings) as [key, value] (key)}
							<div class="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
								<dt class="font-mono text-xs text-zinc-600">{key}</dt>
								<Badge.Root variant="outline">{SETTING_TYPES[key]}</Badge.Root>
								<dd class="ml-auto font-medium text-zinc-900 tabular-nums">{String(value)}</dd>
							</div>
						{/each}
					</dl>
				{:catch error}
					<Callout.Root variant="error">{error.message}</Callout.Root>
				{/await}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>GitHub status</Card.Title>
				<Card.Description>
					<code class="font-mono text-xs">GET /github-status</code> calls an outside API.
					<code class="font-mono text-xs">ctx.fetch</code> only reaches the hosts in
					<code class="font-mono text-xs">permissions.network</code>.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
					{#await github}
						<StatusDot status="loading" />
						<span class="text-sm text-zinc-500">Checking…</span>
					{:then { indicator, description }}
						<StatusDot status={GITHUB_STATUS[indicator]} />
						<span class="text-sm font-medium text-zinc-900">{description}</span>
					{:catch error}
						<StatusDot status="error" />
						<span class="text-sm text-red-700">{error.message}</span>
					{/await}

					<Button.Root
						variant="ghost"
						size="icon-sm"
						class="ml-auto"
						aria-label="Check again"
						onclick={checkGitHub}
					>
						<Icon.Root icon="lucide:refresh-cw" />
					</Button.Root>
				</div>

				<p class="text-xs text-zinc-400">
					Checked at {checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
					from www.githubstatus.com
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<Section title="Pages" description="Every page in pages of plugin.ts, at its own path.">
		<Card.Root class="divide-y divide-zinc-100">
			{#each PAGES as item (item.path)}
				<a
					href={pageHref(item.path)}
					class="group flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-50"
				>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="text-sm font-medium text-zinc-900">{item.title}</span>
						<span class="truncate text-sm text-zinc-500">{item.description}</span>
					</div>
					<code class="hidden font-mono text-xs text-zinc-400 sm:block"
						>pages/{item.path}.svelte</code
					>
					<Icon.Root
						icon="lucide:chevron-right"
						class="size-4 text-zinc-400 transition-transform group-hover:translate-x-0.5"
					/>
				</a>
			{/each}
		</Card.Root>

		<!-- Everything below the page's path reaches it as `params`. -->
		<p class="text-sm text-zinc-500">
			{#if params.length}
				This page got the params
				{#each params as param (param)}
					<Badge.Root variant="outline" class="mx-0.5 font-mono">{param}</Badge.Root>
				{/each}
				from the path below it.
			{:else}
				A path below a page reaches it as <code class="font-mono text-xs">params</code>: try
				<Link.Root href={pageHref('overview/hello/world')}
					>/plugins/demo/overview/hello/world</Link.Root
				>.
			{/if}
		</p>
	</Section>
</div>
