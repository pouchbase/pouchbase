<script lang="ts">
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as CardHeading from '#lib/components/ui/card-heading/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as RowActions from '#lib/components/ui/row-actions/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { describeCron } from '#lib/backups/cron.js';
	import DeleteScheduleDialog from './delete-schedule-dialog.svelte';
	import ScheduleDialog from './schedule-dialog.svelte';
	import type { Destination, Schedule } from './types';

	type Props = {
		schedules: Schedule[];
		destinations: Destination[];
		format: (date: Date) => string;
	};

	let { schedules, destinations, format }: Props = $props();

	const dialogs = Dialog.getDialogs();
</script>

<Card.Root>
	<CardHeading.Root title="Schedules">
		{#snippet description()}
			Backups made automatically. They run on the Worker's Cron Trigger or the Node server's timer,
			also when nobody is logged in.
		{/snippet}

		{#snippet actions()}
			<Button.Root
				variant="secondary"
				onclick={() => void dialogs.open(ScheduleDialog, { destinations })}
			>
				<Icon.Root icon="lucide:plus" />
				New schedule
			</Button.Root>
		{/snippet}
	</CardHeading.Root>

	<Card.Content>
		{#if schedules.length}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>When</Table.Head>
						<Table.Head>Destination</Table.Head>
						<Table.Head>Keeps</Table.Head>
						<Table.Head>Next backup</Table.Head>
						<Table.Head><span class="sr-only">Actions</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each schedules as schedule (schedule.id)}
						<Table.Row>
							<Table.Cell class="font-medium text-zinc-900">
								<span class="flex flex-wrap items-center gap-2">
									{describeCron(schedule.cron)}
									{#if schedule.includeFiles}
										<Badge.Root variant="outline">With files</Badge.Root>
									{/if}
								</span>
							</Table.Cell>
							<Table.Cell>{schedule.destinationName}</Table.Cell>
							<Table.Cell class="tabular-nums">
								{schedule.keep === 0 ? 'All' : schedule.keep}
							</Table.Cell>
							<Table.Cell class="whitespace-nowrap">
								{#if schedule.enabled}
									{format(schedule.nextRunAt)}
								{:else}
									<Badge.Root>Paused</Badge.Root>
								{/if}
							</Table.Cell>
							<Table.Cell class="w-0 text-right">
								<RowActions.Root label="Schedule actions">
									<RowActions.Item
										icon="lucide:pencil"
										onSelect={() => void dialogs.open(ScheduleDialog, { destinations, schedule })}
									>
										Edit
									</RowActions.Item>

									<RowActions.Separator />

									<RowActions.Item
										variant="danger"
										icon="lucide:trash-2"
										onSelect={() => void dialogs.open(DeleteScheduleDialog, { schedule })}
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
				<Empty.Description>No schedules yet.</Empty.Description>
			</Empty.Root>
		{/if}
	</Card.Content>
</Card.Root>
