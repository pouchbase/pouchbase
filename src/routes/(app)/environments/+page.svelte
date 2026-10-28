<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Page from '#lib/components/ui/page/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as CardHeading from '#lib/components/ui/card-heading/index.js';
	import * as RowActions from '#lib/components/ui/row-actions/index.js';
	import CreateDeployTokenDialog from './create-deploy-token-dialog.svelte';
	import DeleteDeployTokenDialog from './delete-deploy-token-dialog.svelte';
	import DeploymentsCard from './deployments-card.svelte';
	import EnvironmentCard from './environment-card.svelte';
	import { getDeployTokens } from './environments.remote';
	import LinkedInstanceCard from './linked-instance-card.svelte';

	const tokens = $derived(await getDeployTokens());

	const dialogs = Dialog.getDialogs();

	const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head>
	<title>Environments · Pouchbase</title>
</svelte:head>

<Page.Layout
	title="Environments"
	width="narrow"
	gap="tight"
	description="Build the schema on a development instance and publish it to production: collections, functions, plugins and settings. Records, users and secrets stay where they are."
>
	<EnvironmentCard />

	<LinkedInstanceCard />

	<Card.Root>
		<CardHeading.Root
			title="Deploy tokens"
			description="Other instances use a deploy token to read this instance's schema and publish to it. Create one on production and enter it on your development instance."
		>
			{#snippet actions()}
				<Button.Root variant="secondary" onclick={() => void dialogs.open(CreateDeployTokenDialog)}>
					<Icon.Root icon="lucide:plus" />
					New token
				</Button.Root>
			{/snippet}
		</CardHeading.Root>

		<Card.Content>
			{#if tokens.length}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Name</Table.Head>
							<Table.Head>Created</Table.Head>
							<Table.Head>Last used</Table.Head>
							<Table.Head><span class="sr-only">Actions</span></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each tokens as token (token.id)}
							<Table.Row>
								<Table.Cell class="font-medium text-zinc-900">{token.name}</Table.Cell>
								<Table.Cell class="whitespace-nowrap">
									{dateFormat.format(token.createdAt)}
								</Table.Cell>
								<Table.Cell class="whitespace-nowrap">
									{token.lastUsedAt ? dateFormat.format(token.lastUsedAt) : 'Never'}
								</Table.Cell>
								<Table.Cell class="w-0 text-right">
									<RowActions.Root label="Token actions">
										<RowActions.Item
											variant="danger"
											icon="lucide:trash-2"
											onSelect={() => void dialogs.open(DeleteDeployTokenDialog, { token })}
										>
											Delete
										</RowActions.Item>
									</RowActions.Root>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<Empty.Root class="py-8">
					<Empty.Title>No deploy tokens</Empty.Title>
					<Empty.Description>No other instance can publish to this one.</Empty.Description>
				</Empty.Root>
			{/if}
		</Card.Content>
	</Card.Root>

	<DeploymentsCard />
</Page.Layout>
