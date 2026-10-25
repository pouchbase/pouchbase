<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Badge from '@pouchbasejs/ui/badge';
	import * as Link from '@pouchbasejs/ui/link';

	import { formatPhone } from '../../lib/phone.js';

	let { value }: FieldPreviewProps<string> = $props();

	const phone = $derived(value === null ? null : formatPhone(value));
</script>

{#if value !== null && phone}
	<span class="inline-flex items-center gap-1.5">
		{#if phone.country}
			<Badge.Root variant="outline" title={phone.country.name}>{phone.country.code}</Badge.Root>
		{/if}
		<Link.Root href={`tel:${value}`} class="whitespace-nowrap tabular-nums">{phone.text}</Link.Root>
	</span>
{/if}
