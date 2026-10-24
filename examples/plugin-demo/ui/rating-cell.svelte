<script lang="ts">
	import type { FieldCellProps } from '@pouchbasejs/plugin-sdk/ui';

	import { MAX_RATING, stars } from './rating.js';

	let { value }: FieldCellProps<number> = $props();
</script>

{#if value !== null}
	<span title={`${value} of ${MAX_RATING}`}>{stars(value)}</span>
{/if}
