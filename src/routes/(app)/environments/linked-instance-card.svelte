<script lang="ts">
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as CardHeading from '#lib/components/ui/card-heading/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as RowActions from '#lib/components/ui/row-actions/index.js';
	import { toast } from '#lib/components/ui/toast/index.js';
	import { getRemote, unlinkRemote } from './environments.remote';
	import LinkInstanceDialog from './link-instance-dialog.svelte';
	import PlanDialog from './plan-dialog.svelte';

	const remote = $derived(await getRemote());

	const dialogs = Dialog.getDialogs();

	async function unlink() {
		await unlinkRemote();
		toast.success('Instance unlinked');
	}
</script>

<Card.Root>
	<CardHeading.Root title="Linked instance">
		{#snippet description()}
			{#if remote}
				Publish this instance's schema to it, or pull its schema into this instance.
			{:else}
				Link your production instance to publish this instance's schema to it, or to start from its
				schema.
			{/if}
		{/snippet}

		{#snippet actions()}
			{#if remote}
				<RowActions.Root label="Linked instance actions">
					<RowActions.Item
						icon="lucide:pencil"
						onSelect={() => void dialogs.open(LinkInstanceDialog)}
					>
						Change
					</RowActions.Item>

					<RowActions.Separator />

					<RowActions.Item variant="danger" icon="lucide:unlink" onSelect={() => void unlink()}>
						Unlink
					</RowActions.Item>
				</RowActions.Root>
			{:else}
				<Button.Root variant="secondary" onclick={() => void dialogs.open(LinkInstanceDialog)}>
					<Icon.Root icon="lucide:link" />
					Link instance
				</Button.Root>
			{/if}
		{/snippet}
	</CardHeading.Root>

	{#if remote}
		<Card.Content>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<Icon.Root icon="lucide:globe" class="size-4 shrink-0 text-zinc-500" />
					<span class="truncate font-mono text-sm text-zinc-900">{remote.url}</span>
					{#if !remote.hasToken}
						<Badge.Root variant="warning">No token</Badge.Root>
					{/if}
				</div>

				<div class="flex gap-2">
					<Button.Root
						variant="secondary"
						onclick={() => void dialogs.open(PlanDialog, { direction: 'pull' })}
					>
						<Icon.Root icon="lucide:download" />
						Pull
					</Button.Root>
					<Button.Root onclick={() => void dialogs.open(PlanDialog, { direction: 'publish' })}>
						<Icon.Root icon="lucide:upload" />
						Publish
					</Button.Root>
				</div>
			</div>
		</Card.Content>
	{/if}
</Card.Root>
