<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Input from '@pouchbasejs/ui/inputs/input';
	import * as Select from '@pouchbasejs/ui/inputs/select';

	import {
		composePhone,
		COUNTRIES,
		countryOf,
		formatPhone,
		normalizePhone
	} from '../../lib/phone.js';

	let { name, value, required, disabled, id, errorId }: FieldInputProps<string> = $props();

	const OTHER = 'other';

	const items: Select.Item[] = [
		...COUNTRIES.map((country) => ({
			value: country.code,
			label: `${country.code} +${country.dial}`,
			description: country.name
		})),
		{ value: OTHER, label: 'Other', description: 'Type the whole number with its + code' }
	];

	// Split the record's number into a country and the rest; a new record starts in the first country.
	const initial = $derived(value ? countryOf(value) : COUNTRIES[0]!);

	let code = $derived(initial?.code ?? OTHER);
	let number = $derived(value && initial ? value.slice(initial.dial.length + 1) : (value ?? ''));

	const country = $derived(COUNTRIES.find((item) => item.code === code) ?? null);
	const phone = $derived(composePhone(country, number));
	const valid = $derived(normalizePhone(phone));
	const invalid = $derived(number.trim() !== '' && valid === null);
</script>

<!-- The country and the number are two controls; the hidden input submits them as one number. -->
<input type="hidden" {name} value={phone} />

<div class="flex flex-col gap-1.5">
	<div class="flex gap-2">
		<!--
			The width goes on a wrapper, which the select's own `w-full` fills. As `w-30` on the select it
			would lose: of two classes that set the same property, Tailwind's order decides, not the order
			in `class`, and `w-full` comes after `w-30`.
		-->
		<div class="w-30 flex-none">
			<Select.Root {items} bind:value={code} {disabled} aria-label="Country code" />
		</div>

		<Input.Root
			type="tel"
			class="min-w-0 flex-1 tracking-wide tabular-nums"
			{id}
			bind:value={number}
			{required}
			{disabled}
			placeholder={country ? '6 12345678' : '+1 555 123 4567'}
			autocomplete={country ? 'tel-national' : 'tel'}
			inputmode="tel"
			aria-invalid={invalid || undefined}
			aria-describedby={errorId}
		/>
	</div>

	<p class="text-xs text-zinc-500" aria-live="polite">
		{#if valid}
			Saved as <span class="font-medium text-zinc-900 tabular-nums">{formatPhone(valid).text}</span>
		{:else if invalid}
			{country ? `Use the number without +${country.dial}` : 'Start with + and the country code'}
		{:else}
			Spaces, dashes and a leading 0 are fine.
		{/if}
	</p>
</div>
