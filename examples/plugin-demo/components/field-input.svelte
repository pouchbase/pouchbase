<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';
	import type { Component } from 'svelte';

	import ColorInput from '../fields/color/input.svelte';
	import PhoneInput from '../fields/phone/input.svelte';
	import RatingInput from '../fields/rating/input.svelte';
	import { fieldInfo, type FieldTypeId } from '../lib/catalog.js';

	type Props = {
		type: FieldTypeId;
		name: string;
		id: string;
		value: string | number | null;
		disabled: boolean;
	};

	let { type, name, id, value, disabled }: Props = $props();

	// The same components Pouchbase renders in the record form, with the props it passes them.
	const inputs = {
		color: ColorInput,
		phone: PhoneInput,
		rating: RatingInput
	} as Record<FieldTypeId, Component<FieldInputProps<string | number>>>;

	const Input = $derived(inputs[type]);
</script>

<Input field={fieldInfo(type, name)} {name} {id} {value} {disabled} required={false} />
