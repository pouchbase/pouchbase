<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Segmented from '@pouchbasejs/ui/segmented';

	import { RATINGS } from './rating.js';

	let { field, name, value, required, disabled, id, errorId }: FieldInputProps<number> = $props();

	// Starts at the record's value; the hidden input below submits it with the record form.
	let current = $derived(value === null ? '' : String(value));
</script>

<input type="hidden" {id} {name} value={current} {required} aria-describedby={errorId} />

<Segmented.Root
	value={current}
	onValueChange={(next) => (current = next)}
	aria-label={field.name}
	{disabled}
>
	{#each RATINGS as rating (rating)}
		<Segmented.Item value={String(rating)} aria-label={`${rating} of ${RATINGS.length}`}>
			{rating}★
		</Segmented.Item>
	{/each}
</Segmented.Root>
