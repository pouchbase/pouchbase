<script lang="ts">
	import { untrack } from 'svelte';
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { deleteApiKey } from './api-keys.remote';
	import type { ApiKey } from './types';

	let { apiKey, close }: { apiKey: ApiKey } & DialogProps = $props();

	const form = $derived.by(() => {
		const key = apiKey.id;

		return untrack(() => deleteApiKey.for(key));
	});
</script>

<ConfirmDialog.Root
	{form}
	title="Delete API key"
	submit="Delete key"
	success="API key deleted"
	hidden={[{ field: form.fields.id, value: apiKey.id }]}
	{close}
>
	{#snippet description()}
		Code that uses <strong class="font-medium text-zinc-900">{apiKey.name}</strong> can no longer call
		the API with it, for example to send email.
	{/snippet}
</ConfirmDialog.Root>
