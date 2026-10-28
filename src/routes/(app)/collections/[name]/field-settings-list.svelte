<script lang="ts">
	import type { AnyRemoteFormField } from '#lib/components/ui/form/form-context.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { MAX_LIST_VALUE_LENGTH, MAX_LIST_VALUES } from '#lib/fields/field-types.js';
	import type { InitialSettings } from './field-settings.js';

	type Props = {
		listValues: AnyRemoteFormField;
		initial: InitialSettings;
		/** Whether an existing field is edited. */
		editing: boolean;
	};

	let { listValues, initial, editing }: Props = $props();
</script>

<Form.Field field={listValues}>
	<Form.Label>Items</Form.Label>
	<Form.ItemList
		defaultValue={initial.listValues}
		placeholder="e.g. Draft"
		max={MAX_LIST_VALUES}
		maxLength={MAX_LIST_VALUE_LENGTH}
	/>
	<Form.Description>
		Records pick from these items. Press Enter to add one, paste several lines to add them all, and
		drag to change the order.
		{#if editing}
			Items that records use can't be removed.
		{/if}
	</Form.Description>
	<Form.Errors />
</Form.Field>
