<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as CardHeading from '#lib/components/ui/card-heading/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as RowActions from '#lib/components/ui/row-actions/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { toast } from '#lib/components/ui/toast/index.js';
	import { errorMessage, errorToast } from '#lib/errors.js';
	import { discoverBackups } from './backups.remote';
	import DeleteDestinationDialog from './delete-destination-dialog.svelte';
	import DestinationDialog from './destination-dialog.svelte';
	import type { Destination } from './types';

	type Props = {
		destinations: Destination[];
		/** A backup or a restore is running, so destinations can't be deleted. */
		active: boolean;
	};

	let { destinations, active }: Props = $props();

	const dialogs = Dialog.getDialogs();

	function host(endpoint: string) {
		return URL.canParse(endpoint) ? new URL(endpoint).host : endpoint;
	}

	async function discover(destination: Destination) {
		try {
			const { added } = await discoverBackups(destination.id);

			toast.success(
				added === 0
					? `No new backups in ${destination.name}`
					: `Added ${added === 1 ? '1 backup' : `${added} backups`} from ${destination.name}`
			);
		} catch (error) {
			toast.error(errorMessage(error), errorToast(error));
		}
	}
</script>

<Card.Root>
	<CardHeading.Root title="Destinations" description="The buckets backups are stored in.">
		{#snippet actions()}
			<Button.Root variant="secondary" onclick={() => void dialogs.open(DestinationDialog, {})}>
				<Icon.Root icon="lucide:plus" />
				Add destination
			</Button.Root>
		{/snippet}
	</CardHeading.Root>

	<Card.Content>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head>Bucket</Table.Head>
					<Table.Head>Folder</Table.Head>
					<Table.Head><span class="sr-only">Actions</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each destinations as destination (destination.id)}
					<Table.Row>
						<Table.Cell class="font-medium text-zinc-900">{destination.name}</Table.Cell>
						<Table.Cell>{destination.bucket} on {host(destination.endpoint)}</Table.Cell>
						<Table.Cell class="font-mono text-xs">{destination.prefix}/</Table.Cell>
						<Table.Cell class="w-0 text-right">
							<RowActions.Root label="Destination actions">
								<RowActions.Item
									icon="lucide:pencil"
									onSelect={() => void dialogs.open(DestinationDialog, { destination })}
								>
									Edit
								</RowActions.Item>

								<RowActions.Item icon="lucide:search" onSelect={() => void discover(destination)}>
									Find backups
								</RowActions.Item>

								<RowActions.Separator />

								<RowActions.Item
									variant="danger"
									icon="lucide:trash-2"
									disabled={active}
									onSelect={() => void dialogs.open(DeleteDestinationDialog, { destination })}
								>
									Delete
								</RowActions.Item>
							</RowActions.Root>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>
