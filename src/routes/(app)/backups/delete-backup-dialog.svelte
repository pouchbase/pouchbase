<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteBackup } from './backups.remote';
	import type { Backup } from './types';

	type Props = {
		backup: Backup;
		/** When the backup was made, e.g. `Oct 23, 2026, 3:00 AM`. */
		label: string;
	} & DialogProps;

	let { backup, label, close }: Props = $props();

	const form = $derived.by(() => {
		const key = backup.id;

		return untrack(() => deleteBackup.for(key));
	});
</script>

<ConfirmDialog.Root
	{form}
	title="Delete backup"
	submit="Delete backup"
	success="Backup deleted"
	hidden={[{ field: form.fields.id, value: backup.id }]}
	{close}
>
	{#snippet description()}
		This permanently deletes the backup of
		<strong class="font-medium text-zinc-900">{label}</strong> from {backup.destinationName}. Copies
		of files stay, because other backups share them. This can't be undone.
	{/snippet}
</ConfirmDialog.Root>
