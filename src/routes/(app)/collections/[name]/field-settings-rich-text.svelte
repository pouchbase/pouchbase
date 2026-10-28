<script lang="ts">
	import type { AnyRemoteFormField } from '#lib/components/ui/form/form-context.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import type { InitialSettings } from './field-settings.js';

	type Props = {
		format: AnyRemoteFormField;
		initial: InitialSettings;
		/** Whether an existing field is edited. */
		editing: boolean;
	};

	let { format, initial, editing }: Props = $props();

	const formatItems = [
		{ value: 'html', label: 'HTML', description: 'Stored as HTML markup.' },
		{ value: 'markdown', label: 'Markdown', description: 'Stored as Markdown text.' }
	];
</script>

<Form.Field field={format}>
	<Form.Label>Store as</Form.Label>
	<Form.Select items={formatItems} defaultValue={initial.format} />
	{#if editing}
		<Form.Description>Existing content isn't converted.</Form.Description>
	{/if}
	<Form.Errors />
</Form.Field>
