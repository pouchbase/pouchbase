<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteBackupDestination } from './backups.remote';
	import type { Destination } from './types';

	let { destination, close }: { destination: Destination } & DialogProps = $props();

	const form = $derived.by(() => {
		const key = destination.id;

		return untrack(() => deleteBackupDestination.for(key));
	});
</script>

<ConfirmDialog.Root
	{form}
	title="Delete destination"
	submit="Delete destination"
	success="Destination deleted"
	hidden={[{ field: form.fields.id, value: destination.id }]}
	{close}
>
	{#snippet description()}
		Pouchbase forgets <strong class="font-medium text-zinc-900">{destination.name}</strong>, its
		schedules and its list of backups. The backups stay in the bucket: add the destination again and
		use Find backups to list them.
	{/snippet}
</ConfirmDialog.Root>
