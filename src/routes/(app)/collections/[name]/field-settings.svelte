<script lang="ts">
	import type { AnyRemoteFormField } from '#lib/components/ui/form/form-context.js';
	import type { FieldTypeId } from '#lib/fields/field-types.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { fieldTypeInfo } from '#lib/fields/field-type-info.js';
	import FieldSettingsDefault from './field-settings-default.svelte';
	import FieldSettingsFile from './field-settings-file.svelte';
	import FieldSettingsId from './field-settings-id.svelte';
	import FieldSettingsList from './field-settings-list.svelte';
	import FieldSettingsRelation from './field-settings-relation.svelte';
	import FieldSettingsRichText from './field-settings-rich-text.svelte';
	import { initialSettings } from './field-settings.js';
	import type { GridField } from './grid';

	type Props = {
		type: FieldTypeId;
		/** The settings fields of the surrounding remote form (add field or edit field). */
		formFields: {
			idGenerator: AnyRemoteFormField;
			defaultValue: AnyRemoteFormField;
			defaultSql: AnyRemoteFormField;
			format: AnyRemoteFormField;
			multiple: AnyRemoteFormField;
			onDelete: AnyRemoteFormField;
			listValues: AnyRemoteFormField;
			fileTypes: AnyRemoteFormField;
			customFileTypes: AnyRemoteFormField;
			maxFileSize: AnyRemoteFormField;
		};
		/** The field being edited: its settings are the starting values. Leave out for a new field. */
		field?: GridField;
		/** Relation fields: id of the related collection, whose records can be the default value. */
		relationCollectionId?: string;
	};

	let { type, formFields, field, relationCollectionId }: Props = $props();

	// Starting values: the field's current settings, or the defaults of a new field.
	const initial = $derived(initialSettings(field));
	const editing = $derived(!!field);
</script>

{#if type === 'id'}
	<FieldSettingsId idGenerator={formFields.idGenerator} {initial} {editing} />
{/if}

{#if type === 'rich_text'}
	<FieldSettingsRichText format={formFields.format} {initial} {editing} />
{/if}

{#if type === 'list'}
	<FieldSettingsList listValues={formFields.listValues} {initial} {editing} />
{/if}

{#if type === 'relation' || type === 'list'}
	<Form.Field field={formFields.multiple} orientation="horizontal">
		<Form.Checkbox defaultChecked={initial.multiple} />
		<Form.Label>Allow multiple</Form.Label>
		<Form.Description class="w-full pl-6">
			{type === 'relation'
				? 'Link several records instead of one; stored as a JSON array of ids.'
				: 'Pick several items instead of one; stored as a JSON array.'}
			{#if field}
				Existing values are converted when you save.
			{/if}
		</Form.Description>
		<Form.Errors />
	</Form.Field>
{/if}

{#if type === 'relation'}
	<FieldSettingsRelation onDelete={formFields.onDelete} {initial} />
{/if}

{#if type === 'file'}
	<FieldSettingsFile
		fileTypes={formFields.fileTypes}
		customFileTypes={formFields.customFileTypes}
		maxFileSize={formFields.maxFileSize}
		{initial}
	/>
{/if}

{#if fieldTypeInfo(type).defaultable}
	<FieldSettingsDefault {type} {formFields} {initial} {field} {relationCollectionId} />
{/if}
