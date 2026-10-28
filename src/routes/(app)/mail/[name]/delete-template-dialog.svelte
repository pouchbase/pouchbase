<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteMailTemplate } from '../mail.remote';

	let { name, close }: { name: string } & DialogProps = $props();

	const form = $derived.by(() => {
		const key = name;

		return untrack(() => deleteMailTemplate.for(key));
	});
</script>

<!-- Deleting redirects to the Mail page. -->
<ConfirmDialog.Root
	{form}
	title="Delete template"
	submit="Delete template"
	success="Template deleted"
	hidden={[{ field: form.fields.name, value: name }]}
	{close}
	redirects
>
	{#snippet description()}
		Code that sends <strong class="font-medium text-zinc-900">{name}</strong> gets a
		<code>404</code> from then on.
	{/snippet}
</ConfirmDialog.Root>
