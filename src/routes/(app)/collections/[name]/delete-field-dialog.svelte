<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteField } from './fields.remote';

	type Props = {
		collection: { name: string };
		field: { id: string; name: string };
	} & DialogProps;

	let { collection, field, close }: Props = $props();

	const form = $derived.by(() => {
		const key = field.id;

		return untrack(() => deleteField.for(key));
	});
</script>

<ConfirmDialog.Root
	{form}
	title="Delete field"
	submit="Delete field"
	success="Field deleted"
	hidden={[
		{ field: form.fields.collection, value: collection.name },
		{ field: form.fields.name, value: field.name }
	]}
	{close}
>
	{#snippet description()}
		This permanently deletes the field
		<strong class="font-medium text-zinc-900">{field.name}</strong> and its value in every record. This
		can't be undone.
	{/snippet}
</ConfirmDialog.Root>
