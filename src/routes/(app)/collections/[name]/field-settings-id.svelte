<script lang="ts">
	import type { AnyRemoteFormField } from '#lib/components/ui/form/form-context.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { ID_GENERATOR_IDS, ID_GENERATORS } from '#lib/fields/field-types.js';
	import type { InitialSettings } from './field-settings.js';

	type Props = {
		idGenerator: AnyRemoteFormField;
		initial: InitialSettings;
		/** Whether an existing field is edited. */
		editing: boolean;
	};

	let { idGenerator, initial, editing }: Props = $props();

	// An auto-increment id is an integer column; the other generators make text, so an existing
	// id field can only switch between those.
	const generatorItems = $derived(
		ID_GENERATOR_IDS.filter(
			(id) => !editing || (id === 'autoincrement') === (initial.generator === 'autoincrement')
		).map((id) => ({
			value: id,
			label: ID_GENERATORS[id].label,
			description: ID_GENERATORS[id].description
		}))
	);
</script>

<Form.Field field={idGenerator}>
	<Form.Label>Generator</Form.Label>
	<Form.Select
		items={generatorItems}
		defaultValue={initial.generator}
		placeholder="Choose a generator…"
	/>
	<Form.Description>
		{#if editing}
			How the id of a new record is made; existing ids stay as they are.
		{:else}
			How the id of a new record is made. Existing records get one right away.
		{/if}
	</Form.Description>
	<Form.Errors />
</Form.Field>
