<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Page from '#lib/components/ui/page/index.js';
	import BackupHistory from './backup-history.svelte';
	import { getBackups } from './backups.remote';
	import CreateBackupDialog from './create-backup-dialog.svelte';
	import DestinationDialog from './destination-dialog.svelte';
	import DestinationsCard from './destinations-card.svelte';
	import RestoreStatus from './restore-status.svelte';
	import SchedulesCard from './schedules-card.svelte';
	import UploadBackupDialog from './upload-backup-dialog.svelte';

	const overview = $derived(await getBackups());

	const dialogs = Dialog.getDialogs();

	const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
	const format = (date: Date) => dateFormat.format(date);

	const restoring = $derived(overview.restore?.status === 'running');
	const active = $derived(
		restoring || overview.backups.some((backup) => backup.status === 'running')
	);
</script>

<svelte:head>
	<title>Backups · Pouchbase</title>
</svelte:head>

<Page.Layout
	title="Backups"
	description="Copies of the databases, and optionally the uploaded files, in S3-compatible storage."
>
	{#snippet actions()}
		<div class="flex flex-wrap gap-2">
			<Button.Root
				variant="secondary"
				disabled={!overview.destinations.length}
				onclick={() =>
					void dialogs.open(UploadBackupDialog, { destinations: overview.destinations })}
			>
				<Icon.Root icon="lucide:upload" />
				Upload backup
			</Button.Root>

			<Button.Root
				disabled={!overview.destinations.length || restoring}
				onclick={() =>
					void dialogs.open(CreateBackupDialog, { destinations: overview.destinations })}
			>
				<Icon.Root icon="lucide:database-backup" />
				Back up now
			</Button.Root>
		</div>
	{/snippet}

	{#if overview.restore}
		<RestoreStatus restore={overview.restore} {format} />
	{/if}

	<!-- Shows the error of driving running jobs, and the history when there are destinations. -->
	<BackupHistory {overview} {restoring} {active} {format} />

	{#if !overview.destinations.length}
		<Empty.Root>
			<Empty.Icon><Icon.Root icon="lucide:database-backup" /></Empty.Icon>
			<Empty.Title>No destination yet</Empty.Title>
			<Empty.Description>
				Add an S3-compatible bucket, such as Amazon S3, Cloudflare R2 or Backblaze B2, to store
				backups in.
			</Empty.Description>
			<Button.Root onclick={() => void dialogs.open(DestinationDialog, {})}>
				<Icon.Root icon="lucide:plus" />
				Add destination
			</Button.Root>
		</Empty.Root>
	{:else}
		<SchedulesCard schedules={overview.schedules} destinations={overview.destinations} {format} />

		<DestinationsCard destinations={overview.destinations} {active} />
	{/if}
</Page.Layout>
