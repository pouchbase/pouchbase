<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as RowActions from '#lib/components/ui/row-actions/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { errorMessage } from '#lib/errors.js';
	import { formatFileSize } from '#lib/files/files.js';
	import BackupStatusBadge from './backup-status-badge.svelte';
	import { advanceBackups, getBackups } from './backups.remote';
	import DeleteBackupDialog from './delete-backup-dialog.svelte';
	import RestoreBackupDialog from './restore-backup-dialog.svelte';
	import type { Backup, BackupsOverview } from './types';

	type Props = {
		overview: BackupsOverview;
		/** A restore is running. */
		restoring: boolean;
		/** A backup or a restore is running. */
		active: boolean;
		format: (date: Date) => string;
	};

	let { overview, restoring, active, format }: Props = $props();

	const dialogs = Dialog.getDialogs();

	let failure = $state<string | null>(null);
	let advancing = false;

	// Leaving the page stops driving the jobs; scheduled ticks continue them.
	let stopped = false;

	$effect(() => () => {
		stopped = true;
	});

	$effect(() => {
		if (active && !advancing) {
			untrack(() => void advance());
		}
	});

	/** Runs steps of the running jobs from this page, so they finish without waiting for ticks. */
	async function advance() {
		advancing = true;
		failure = null;

		const wasRestoring = restoring;

		try {
			while (!stopped) {
				const { running } = await advanceBackups();

				await getBackups().refresh();

				if (!running) {
					break;
				}
			}
		} catch (error) {
			failure = errorMessage(error);
		} finally {
			advancing = false;
		}

		// The databases changed under the page: load everything again.
		if (wasRestoring && !stopped && overview.restore?.status === 'completed') {
			window.location.reload();
		}
	}

	function details(backup: Backup) {
		const parts = [backup.size ? formatFileSize(backup.size) : null];

		if (backup.includeFiles) {
			parts.push(backup.files === 1 ? '1 new file' : `${backup.files} new files`);
		}

		return parts.filter(Boolean).join(' · ') || '—';
	}
</script>

<!-- Mounted even without destinations, so a running restore is still driven from this page. -->
{#if failure}
	<Callout.Root variant="error">
		<Callout.Icon><Icon.Root icon="lucide:circle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Description>
				{failure}. Running backups continue in the background.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>
{/if}

{#if overview.destinations.length}
	<section class="flex flex-col gap-3" aria-labelledby="backups-history">
		<h2 id="backups-history" class="text-base font-semibold text-zinc-900">History</h2>

		{#if overview.backups.length}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Made</Table.Head>
						<Table.Head>Destination</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>Size</Table.Head>
						<Table.Head><span class="sr-only">Actions</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each overview.backups as backup (backup.id)}
						<Table.Row>
							<Table.Cell class="font-medium whitespace-nowrap text-zinc-900">
								<span class="flex items-center gap-2">
									{format(backup.startedAt)}
									<Badge.Root variant="outline">
										{backup.scheduled ? 'Scheduled' : 'Manual'}
									</Badge.Root>
								</span>
							</Table.Cell>
							<Table.Cell>{backup.destinationName}</Table.Cell>
							<Table.Cell>
								<BackupStatusBadge status={backup.status} step={backup.step} error={backup.error} />
							</Table.Cell>
							<Table.Cell class="whitespace-nowrap tabular-nums">{details(backup)}</Table.Cell>
							<Table.Cell class="w-0 text-right">
								<RowActions.Root label="Backup actions" disabled={backup.status === 'running'}>
									<RowActions.Item
										icon="lucide:archive-restore"
										disabled={backup.status !== 'completed' || active}
										onSelect={() =>
											void dialogs.open(RestoreBackupDialog, {
												backup,
												label: format(backup.startedAt)
											})}
									>
										Restore
									</RowActions.Item>

									<!-- The archive is sent as an attachment, so the page stays open. -->
									<RowActions.Item
										icon="lucide:download"
										disabled={backup.status !== 'completed'}
										onSelect={() =>
											window.location.assign(
												resolve('/(app)/backups/[id]/download', { id: backup.id })
											)}
									>
										Download
									</RowActions.Item>

									<RowActions.Separator />

									<RowActions.Item
										variant="danger"
										icon="lucide:trash-2"
										onSelect={() =>
											void dialogs.open(DeleteBackupDialog, {
												backup,
												label: format(backup.startedAt)
											})}
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
				<Empty.Title>No backups yet</Empty.Title>
				<Empty.Description>
					Back up now, or add a schedule to make backups automatically.
				</Empty.Description>
			</Empty.Root>
		{/if}
	</section>
{/if}
