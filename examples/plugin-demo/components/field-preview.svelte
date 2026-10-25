<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';
	import type { Component } from 'svelte';

	import ColorPreview from '../fields/color/preview.svelte';
	import PhonePreview from '../fields/phone/preview.svelte';
	import RatingPreview from '../fields/rating/preview.svelte';
	import { fieldInfo, type FieldTypeId } from '../lib/catalog.js';

	type Props = { type: FieldTypeId; value: string | number | null };

	let { type, value }: Props = $props();

	// The same components Pouchbase renders in the records grid, imported like any other file.
	const previews = {
		color: ColorPreview,
		phone: PhonePreview,
		rating: RatingPreview
	} as Record<FieldTypeId, Component<FieldPreviewProps<string | number>>>;

	const Preview = $derived(previews[type]);
</script>

<Preview field={fieldInfo(type)} {value} />
