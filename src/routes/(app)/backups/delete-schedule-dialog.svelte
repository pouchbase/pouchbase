<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { describeCron } from '#lib/backups/cron.js';
	import { deleteBackupSchedule } from './backups.remote';
	import type { Schedule } from './types';

	let { schedule, close }: { schedule: Schedule } & DialogProps = $props();

	const form = $derived.by(() => {
		const key = schedule.id;

		return untrack(() => deleteBackupSchedule.for(key));
	});
</script>

<ConfirmDialog.Root
	{form}
	title="Delete schedule"
	submit="Delete schedule"
	success="Schedule deleted"
	hidden={[{ field: form.fields.id, value: schedule.id }]}
	{close}
>
	{#snippet description()}
		The backups to {schedule.destinationName} ({describeCron(schedule.cron).toLowerCase()}) stop.
		The backups it made are kept.
	{/snippet}
</ConfirmDialog.Root>
