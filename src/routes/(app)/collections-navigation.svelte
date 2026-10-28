<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Navigation from '#lib/components/ui/navigation/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import * as RowActions from '#lib/components/ui/row-actions/index.js';
	import { USERS_COLLECTION } from '#lib/auth/users.js';
	import { FILES_COLLECTION } from '#lib/files/files.js';
	import { listCollections } from './collections.remote';
	import CreateCollectionDialog from './create-collection-dialog.svelte';
	import ExportCollectionsDialog from './export-collections-dialog.svelte';
	import ImportCollectionsDialog from './import-collections-dialog.svelte';

	const collections = $derived(await listCollections());

	const dialogs = Dialog.getDialogs();
</script>

<Sidebar.Group>
	<Sidebar.GroupHeader>
		<Sidebar.GroupLabel>Collections</Sidebar.GroupLabel>

		<div class="flex items-center">
			<RowActions.Root label="Collections actions">
				<RowActions.Item
					icon="lucide:download"
					onSelect={() => void dialogs.open(ExportCollectionsDialog)}
				>
					Export collections
				</RowActions.Item>
				<RowActions.Item
					icon="lucide:upload"
					onSelect={() => void dialogs.open(ImportCollectionsDialog)}
				>
					Import collections
				</RowActions.Item>
			</RowActions.Root>

			<Button.Root
				variant="ghost"
				size="icon"
				aria-label="Create collection"
				onclick={() => void dialogs.open(CreateCollectionDialog)}
			>
				<Icon.Root icon="lucide:plus" />
			</Button.Root>
		</div>
	</Sidebar.GroupHeader>

	{#if collections.length}
		<Navigation.Root aria-label="Collections">
			{#each collections as collection (collection.id)}
				<Navigation.Item>
					<Navigation.Link href={resolve('/(app)/collections/[name]', { name: collection.name })}>
						{#if collection.system && collection.name === USERS_COLLECTION}
							<Icon.Root icon="lucide:users" />
						{:else if collection.system && collection.name === FILES_COLLECTION}
							<Icon.Root icon="lucide:files" />
						{:else}
							<Icon.Root icon="lucide:table-2" />
						{/if}
						<span class="truncate">{collection.name}</span>
					</Navigation.Link>
				</Navigation.Item>
			{/each}
		</Navigation.Root>
	{:else}
		<Navigation.Empty>No collections yet.</Navigation.Empty>
	{/if}
</Sidebar.Group>
