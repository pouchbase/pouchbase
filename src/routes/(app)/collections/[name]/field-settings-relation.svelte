<script lang="ts">
	import type { AnyRemoteFormField } from '#lib/components/ui/form/form-context.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { RELATION_ON_DELETE, RELATION_ON_DELETE_IDS } from '#lib/fields/field-types.js';
	import type { InitialSettings } from './field-settings.js';

	type Props = {
		onDelete: AnyRemoteFormField;
		initial: InitialSettings;
	};

	let { onDelete, initial }: Props = $props();

	const onDeleteItems = RELATION_ON_DELETE_IDS.map((id) => ({
		value: id,
		label: RELATION_ON_DELETE[id].label,
		description: RELATION_ON_DELETE[id].description
	}));
</script>

<Form.Field field={onDelete}>
	<Form.Label>When a linked record is deleted</Form.Label>
	<Form.Select items={onDeleteItems} defaultValue={initial.onDelete} />
	<Form.Description>
		What happens to records of this collection that link to a record when it is deleted.
	</Form.Description>
	<Form.Errors />
</Form.Field>
