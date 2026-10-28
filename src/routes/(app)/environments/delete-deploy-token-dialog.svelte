<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteDeployToken } from './environments.remote';
	import type { DeployToken } from './types';

	let { token, close }: { token: DeployToken } & DialogProps = $props();

	const form = $derived.by(() => {
		const key = token.id;

		return untrack(() => deleteDeployToken.for(key));
	});
</script>

<ConfirmDialog.Root
	{form}
	title="Delete deploy token"
	submit="Delete token"
	success="Deploy token deleted"
	hidden={[{ field: form.fields.id, value: token.id }]}
	{close}
>
	{#snippet description()}
		Instances that use <strong class="font-medium text-zinc-900">{token.name}</strong> can no longer read
		this instance's schema or publish to it.
	{/snippet}
</ConfirmDialog.Root>
