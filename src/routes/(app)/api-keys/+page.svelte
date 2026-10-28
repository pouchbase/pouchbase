<script lang="ts">
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Page from '#lib/components/ui/page/index.js';
	import * as RowActions from '#lib/components/ui/row-actions/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { getApiKeys } from './api-keys.remote';
	import CreateApiKeyDialog from './create-api-key-dialog.svelte';
	import DeleteApiKeyDialog from './delete-api-key-dialog.svelte';

	const keys = $derived(await getApiKeys());

	const dialogs = Dialog.getDialogs();

	const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head>
	<title>API keys · Pouchbase</title>
</svelte:head>

<Page.Layout title="API keys">
	{#snippet description()}
		Secret keys for server-side code, such as your back-end, to call the API as an admin: the API
		rules don't apply to them. Every function has a key of its own in <code
			>env.POUCHBASE_API_KEY</code
		>, renewed on each deploy.
	{/snippet}

	{#snippet actions()}
		{#if keys.length}
			<Button.Root onclick={() => void dialogs.open(CreateApiKeyDialog)}>
				<Icon.Root icon="lucide:plus" />
				New API key
			</Button.Root>
		{/if}
	{/snippet}

	{#if keys.length}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head>Key</Table.Head>
					<Table.Head>Created</Table.Head>
					<Table.Head>Last used</Table.Head>
					<Table.Head><span class="sr-only">Actions</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each keys as apiKey (apiKey.id)}
					<Table.Row>
						<Table.Cell>
							<span class="flex items-center gap-2 font-medium text-zinc-900">
								{apiKey.name}
								{#if apiKey.functionName}
									<Badge.Root variant="outline">Function</Badge.Root>
								{/if}
							</span>
						</Table.Cell>
						<Table.Cell class="font-mono text-xs whitespace-nowrap">{apiKey.prefix}…</Table.Cell>
						<Table.Cell class="whitespace-nowrap">{dateFormat.format(apiKey.createdAt)}</Table.Cell>
						<Table.Cell class="whitespace-nowrap">
							{apiKey.lastUsedAt ? dateFormat.format(apiKey.lastUsedAt) : 'Never'}
						</Table.Cell>
						<Table.Cell class="w-0 text-right">
							{#if !apiKey.functionName}
								<RowActions.Root label="Key actions">
									<RowActions.Item
										variant="danger"
										icon="lucide:trash-2"
										onSelect={() => void dialogs.open(DeleteApiKeyDialog, { apiKey })}
									>
										Delete
									</RowActions.Item>
								</RowActions.Root>
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{:else}
		<Empty.Root>
			<Empty.Icon><Icon.Root icon="lucide:key-round" /></Empty.Icon>
			<Empty.Title>No API keys yet</Empty.Title>
			<Empty.Description>
				Create a key for your back-end to send email with <code>POST /api/mail/send</code>.
				Functions get a key of their own when they are deployed.
			</Empty.Description>
			<Button.Root onclick={() => void dialogs.open(CreateApiKeyDialog)}>
				<Icon.Root icon="lucide:plus" />
				New API key
			</Button.Root>
		</Empty.Root>
	{/if}
</Page.Layout>
