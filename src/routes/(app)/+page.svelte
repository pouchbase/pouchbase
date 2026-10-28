<script lang="ts">
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Page from '#lib/components/ui/page/index.js';
	import { currentUser } from '../(auth)/auth.remote';
	import { getCloudflareAvailable } from './cloudflare.remote';
	import CloudflareOverview from './cloudflare-overview.svelte';
	import { listCollections } from './collections.remote';

	const [user, collections, cloudflare] = $derived(
		await Promise.all([currentUser(), listCollections(), getCloudflareAvailable()])
	);
</script>

<svelte:head>
	<title>Dashboard · Pouchbase</title>
</svelte:head>

<Page.Layout
	title="Welcome, {user?.email}"
	crumb="Dashboard"
	gap="loose"
	description="Manage your collections{cloudflare
		? ' and keep an eye on your Cloudflare account'
		: ''}."
>
	{#if !collections.length}
		<Empty.Root>
			<Empty.Icon><Icon.Root icon="lucide:table-2" /></Empty.Icon>
			<Empty.Title>No collections yet</Empty.Title>
			<Empty.Description>
				Create your first collection with the + button next to "Collections" in the sidebar.
			</Empty.Description>
		</Empty.Root>
	{/if}

	{#if cloudflare}
		<CloudflareOverview />
	{/if}
</Page.Layout>
