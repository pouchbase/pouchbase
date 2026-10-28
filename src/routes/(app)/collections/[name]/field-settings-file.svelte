<script lang="ts">
	import type { AnyRemoteFormField } from '#lib/components/ui/form/form-context.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { FILE_TYPE_PRESET_IDS, FILE_TYPE_PRESETS } from '#lib/files/accept.js';
	import { MAX_FILE_SIZE_MB } from '#lib/schemas/fields.js';
	import type { InitialSettings } from './field-settings.js';

	type Props = {
		fileTypes: AnyRemoteFormField;
		customFileTypes: AnyRemoteFormField;
		maxFileSize: AnyRemoteFormField;
		initial: InitialSettings;
	};

	let { fileTypes, customFileTypes, maxFileSize, initial }: Props = $props();

	const fileTypeItems = FILE_TYPE_PRESET_IDS.map((id) => ({
		value: id,
		label: FILE_TYPE_PRESETS[id].label,
		description:
			FILE_TYPE_PRESETS[id].rules.length === 1 ? FILE_TYPE_PRESETS[id].rules[0] : undefined
	}));
</script>

<Form.Field field={fileTypes}>
	<Form.Label>File types</Form.Label>
	<Form.MultiSelect items={fileTypeItems} defaultValue={initial.fileTypes} placeholder="Any file" />
	<Form.Description>
		Uploads from the record form are stored in <span class="font-mono">files</span> and linked here. Leave
		empty to accept any file.
	</Form.Description>
	<Form.Errors />
</Form.Field>

<Form.Field field={customFileTypes}>
	<Form.Label>Other types</Form.Label>
	<Form.Input
		defaultValue={initial.customFileTypes}
		placeholder="application/json, .md"
		autocomplete="off"
	/>
	<Form.Description>MIME types or extensions, separated by commas.</Form.Description>
	<Form.Errors />
</Form.Field>

<Form.Field field={maxFileSize}>
	<Form.Label>Max file size (MB)</Form.Label>
	<Form.Input
		type="number"
		step="any"
		defaultValue={initial.maxFileSize}
		placeholder={String(MAX_FILE_SIZE_MB)}
	/>
	<Form.Description>At most {MAX_FILE_SIZE_MB} MB, the limit for every upload.</Form.Description>
	<Form.Errors />
</Form.Field>
