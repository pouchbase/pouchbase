<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { resetMailTemplate } from '../mail.remote';

	let { name, close }: { name: string } & DialogProps<boolean> = $props();

	const form = $derived.by(() => {
		const key = name;

		return untrack(() => resetMailTemplate.for(key));
	});
</script>

<ConfirmDialog.Root
	{form}
	title="Reset template"
	submit="Reset template"
	success="Template reset"
	hidden={[{ field: form.fields.name, value: name }]}
	close={() => close(true)}
>
	{#snippet description()}
		Puts <strong class="font-medium text-zinc-900">{name}</strong> back to the email Pouchbase ships with.
		Your changes are lost.
	{/snippet}
</ConfirmDialog.Root>
