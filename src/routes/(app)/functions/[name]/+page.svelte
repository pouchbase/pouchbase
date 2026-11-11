<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Copy from '#lib/components/ui/inputs/copy/index.js';
	import * as Link from '#lib/components/ui/link/index.js';
	import * as Page from '#lib/components/ui/page/index.js';
	import * as Segmented from '#lib/components/ui/segmented/index.js';
	import * as Spinner from '#lib/components/ui/spinner/index.js';
	import { getFunction } from '../functions.remote';
	import FunctionCode from './function-code.svelte';
	import FunctionLogs from './function-logs.svelte';
	import FunctionSecrets from './function-secrets.svelte';
	import FunctionSettings from './function-settings.svelte';
	import FunctionTest from './function-test.svelte';
	import FunctionVersions from './function-versions.svelte';

	const TABS = [
		{ value: 'code', label: 'Code' },
		{ value: 'test', label: 'Test' },
		{ value: 'secrets', label: 'Secrets' },
		{ value: 'versions', label: 'Versions' },
		{ value: 'logs', label: 'Logs' },
		{ value: 'settings', label: 'Settings' }
	];

	const name = $derived(page.params.name ?? '');
	const fn = $derived(await getFunction(name));

	// Queries can't read the request URL, so the page builds the URL apps call.
	const endpoint = $derived(`${page.url.origin}/api/functions/${fn.name}`);

	let tab = $state('code');
</script>

<svelte:head>
	<title>{fn.name} · Functions · Pouchbase</title>
</svelte:head>

{#snippet loading()}
	<div class="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
		<Spinner.Root />
		Loading…
	</div>
{/snippet}

<Page.Layout
	title={fn.name}
	parents={[{ label: 'Functions', href: resolve('/(app)/functions') }]}
	description={fn.description || undefined}
>
	{#snippet badges()}
		{#if fn.plugin}
			<Badge.Root variant="outline">Plugin: {fn.plugin.name}</Badge.Root>
		{:else if fn.deployed}
			<Badge.Root variant="success">v{fn.version}</Badge.Root>
		{:else}
			<Badge.Root variant="warning">Not deployed</Badge.Root>
		{/if}
		<Badge.Root variant="outline">
			{fn.requireAuth ? 'Signed-in users' : 'Anyone can call it'}
		</Badge.Root>
	{/snippet}

	<Copy.Root value={endpoint} label="Copy URL" />

	{#if fn.plugin}
		<Callout.Root variant="info">
			<Icon.Root icon="lucide:puzzle" class="size-4 shrink-0" />
			<p>
				This function comes with the
				<Link.Root href={resolve('/(app)/plugins')}>{fn.plugin.name}</Link.Root> plugin. It runs in the
				plugin's Worker with the plugin's permissions, and changes when the plugin is updated.
			</p>
		</Callout.Root>
	{:else}
		<Segmented.Root value={tab} onValueChange={(next) => (tab = next)} aria-label="Function">
			{#each TABS as item (item.value)}
				<Segmented.Item value={item.value}>{item.label}</Segmented.Item>
			{/each}
		</Segmented.Root>

		<!-- Each tab loads its own data; the boundary shows a spinner until it is in. -->
		{#key tab}
			<svelte:boundary pending={loading}>
				{#if tab === 'code'}
					<!-- A new version (deploy or restore) starts the editor again from its code. -->
					{#key fn.version}
						<FunctionCode {fn} />
					{/key}
				{:else if tab === 'test'}
					<FunctionTest {fn} />
				{:else if tab === 'secrets'}
					<FunctionSecrets {fn} />
				{:else if tab === 'versions'}
					<FunctionVersions {fn} />
				{:else if tab === 'logs'}
					<FunctionLogs {fn} />
				{:else}
					<FunctionSettings {fn} />
				{/if}
			</svelte:boundary>
		{/key}
	{/if}
</Page.Layout>
