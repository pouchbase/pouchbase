<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteCollection } from '../../collections.remote';

	let { collection }: { collection: { id: string; name: string } } & DialogProps = $props();

	const form = $derived.by(() => {
		const key = collection.id;

		return untrack(() => deleteCollection.for(key));
	});
</script>

<!-- The server redirects to the overview after deleting, so the form keeps its default handling. -->
<ConfirmDialog.Root
	{form}
	title="Delete collection"
	submit="Delete collection"
	success="Collection deleted"
	hidden={[{ field: form.fields.name, value: collection.name }]}
>
	{#snippet description()}
		This permanently deletes the collection
		<strong class="font-medium text-zinc-900">{collection.name}</strong> and all of its records. This
		can't be undone.
	{/snippet}
</ConfirmDialog.Root>
