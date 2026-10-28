<script lang="ts">
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteRecords } from './records.remote';

	type Props = {
		collection: { name: string };
		ids: string[];
	} & DialogProps<boolean>;

	let { collection, ids, close }: Props = $props();

	const label = $derived(ids.length === 1 ? '1 record' : `${ids.length} records`);
</script>

<ConfirmDialog.Root
	form={deleteRecords}
	title="Delete {label}"
	submit="Delete {label}"
	success={ids.length === 1 ? 'Record deleted' : `${ids.length} records deleted`}
	hidden={[
		{ field: deleteRecords.fields.collection, value: collection.name },
		{ field: deleteRecords.fields.ids, value: JSON.stringify(ids) }
	]}
	close={() => close(true)}
>
	{#snippet description()}
		This permanently deletes {label} from
		<span class="font-mono">{collection.name}</span>. This can't be undone.
	{/snippet}
</ConfirmDialog.Root>
