<script lang="ts">
	import * as ConfirmDialog from '#lib/components/ui/confirm-dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import { regenerateTypesToken } from './types.remote';

	let { close }: DialogProps = $props();
</script>

<ConfirmDialog.Root
	form={regenerateTypesToken}
	title="New token"
	submit="Create new token"
	success="New token created"
	{close}
>
	{#snippet description()}
		The current URL stops working. Scripts and CI jobs that generate the types need the new URL.
	{/snippet}
</ConfirmDialog.Root>
