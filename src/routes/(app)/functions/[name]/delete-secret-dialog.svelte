<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteFunctionSecret } from '../functions.remote';
	import type { FunctionData } from '../types';

	let { fn, name, close }: { fn: FunctionData; name: string } & DialogProps = $props();

	const form = $derived.by(() => {
		const key = name;

		return untrack(() => deleteFunctionSecret.for(key));
	});
</script>

<ConfirmDialog.Root
	{form}
	title="Delete secret"
	submit="Delete secret"
	success="Secret deleted"
	hidden={[
		{ field: form.fields.id, value: fn.id },
		{ field: form.fields.name, value: name }
	]}
	{close}
>
	{#snippet description()}
		<code class="font-medium text-zinc-900">env.{name}</code> is no longer set for
		<strong class="font-medium text-zinc-900">{fn.name}</strong>. The value can't be recovered.
	{/snippet}
</ConfirmDialog.Root>
