<script lang="ts">
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteFunction } from '../functions.remote';
	import type { FunctionData } from '../types';

	let { fn, close }: { fn: FunctionData } & DialogProps = $props();
</script>

<!-- Deleting redirects to the Functions page. -->
<ConfirmDialog.Root
	form={deleteFunction}
	title="Delete function"
	submit="Delete function"
	success="Function deleted"
	hidden={[{ field: deleteFunction.fields.id, value: fn.id }]}
	{close}
	redirects
>
	{#snippet description()}
		<strong class="font-medium text-zinc-900">{fn.name}</strong> stops working right away: its Worker,
		secrets and versions are deleted. This can't be undone.
	{/snippet}
</ConfirmDialog.Root>
