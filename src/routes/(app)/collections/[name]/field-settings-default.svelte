<script lang="ts">
	import type { AnyRemoteFormField } from '#lib/components/ui/form/form-context.js';
	import type { FieldTypeId, RichTextFormat } from '#lib/fields/field-types.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { fieldTypeInfo } from '#lib/fields/field-type-info.js';
	import { NOW_DEFAULT, parseListValues } from '#lib/fields/field-types.js';
	import { SQL_DEFAULT_TYPES } from '#lib/fields/sql-expression.js';
	import type { InitialSettings } from './field-settings.js';
	import type { GridField } from './grid';
	import { listRelationOptions } from './records.remote';
	import { SQL_COMPLETIONS } from './sql-completions';

	type Props = {
		type: FieldTypeId;
		formFields: {
			defaultValue: AnyRemoteFormField;
			defaultSql: AnyRemoteFormField;
			format: AnyRemoteFormField;
			listValues: AnyRemoteFormField;
		};
		initial: InitialSettings;
		/** The field being edited; left out for a new field. */
		field?: GridField;
		/** Relation fields: id of the related collection, whose records can be the default value. */
		relationCollectionId?: string;
	};

	let { type, formFields, initial, field, relationCollectionId }: Props = $props();

	// `value()` stays undefined until the control is changed, so fall back to the starting values.
	const format = $derived(
		(formFields.format.value() as RichTextFormat | undefined) ?? initial.format
	);
	const useSql = $derived(
		((formFields.defaultSql.value() as boolean | undefined) ?? initial.defaultSql) &&
			SQL_DEFAULT_TYPES.has(type)
	);
	const listItems = $derived(
		(formFields.listValues.value() === undefined
			? initial.listValues
			: parseListValues(formFields.listValues.value() as string)
		).map((item) => ({ value: item, label: item }))
	);

	// Not awaited, so the dialog opens right away; until the records are in, only the current
	// default can be chosen.
	const relationItems = $derived.by(() => {
		const collectionId = relationCollectionId ?? field?.options.collectionId;
		const records = collectionId ? listRelationOptions(collectionId).current : undefined;
		const items: { value: string; label: string; description?: string }[] = (records ?? []).map(
			(record) => ({
				value: record.id,
				label: record.label,
				description: record.label === record.id ? undefined : record.id
			})
		);

		if (initial.defaultValue && !items.some((item) => item.value === initial.defaultValue)) {
			items.unshift({ value: initial.defaultValue, label: initial.defaultValue });
		}

		return items;
	});

	const booleanItems = [
		{ value: '', label: 'None' },
		{ value: 'true', label: 'True' },
		{ value: 'false', label: 'False' }
	];

	const sqlPlaceholders: Partial<Record<FieldTypeId, string>> = {
		date: "datetime('now', '+7 days')",
		number: 'random() % 100',
		integer: "unixepoch('now')",
		json: "json_object('created', datetime('now'))"
	};

	const defaultPlaceholders: Partial<Record<FieldTypeId, string>> = {
		number: '0.5',
		integer: '0',
		date: '2026-01-31',
		email: 'name@example.com',
		url: 'https://example.com',
		json: '{"key": "value"}'
	};
</script>

<Form.Field field={formFields.defaultValue}>
	<Form.Label>Default value</Form.Label>

	{#if useSql}
		<Form.Code
			language="sql"
			completions={SQL_COMPLETIONS}
			lineNumbers={false}
			defaultValue={initial.defaultSql ? initial.defaultValue : ''}
			placeholder={sqlPlaceholders[type] ?? 'lower(hex(randomblob(4)))'}
			class="h-20"
		/>
	{:else if type === 'rich_text'}
		{#key format}
			<Form.RichText {format} defaultValue={initial.defaultValue} placeholder="Optional" />
		{/key}
	{:else if type === 'list'}
		<Form.Select
			items={[{ value: '', label: 'None' }, ...listItems]}
			defaultValue={initial.defaultValue}
		/>
	{:else if type === 'relation'}
		{#key relationCollectionId}
			<Form.Select
				items={[{ value: '', label: 'None' }, ...relationItems]}
				defaultValue={initial.defaultValue}
				placeholder="Select a record…"
			/>
		{/key}
	{:else if type === 'boolean'}
		<Form.Select items={booleanItems} defaultValue={initial.defaultValue} />
	{:else}
		<Form.Input
			defaultValue={initial.defaultSql ? '' : initial.defaultValue}
			placeholder={defaultPlaceholders[type] ?? 'Optional'}
			autocomplete="off"
		/>
	{/if}

	<Form.Description>
		{#if useSql}
			A SQLite expression, run when a record is created, with SQLite's date, time, text, math and
			JSON functions.
			{#if type === 'date'}
				It must give a date and time, e.g. <span class="font-mono">date('now', '+1 day')</span>;
				stored in UTC.
			{/if}
		{:else if type === 'relation'}
			New records link to this record when they don't set this field. It can't be deleted while it
			is the default.
		{:else if fieldTypeInfo(type).plugin}
			Used when a record doesn't set this field; the plugin checks it when you save.
		{:else}
			Used when a record doesn't set this field.
			{#if type === 'date'}
				Enter <span class="font-mono">{NOW_DEFAULT}</span> for the time the record is created.
			{/if}
		{/if}
		{#if field}
			Only new records get it.
		{/if}
	</Form.Description>
	<Form.Errors />
</Form.Field>

{#if SQL_DEFAULT_TYPES.has(type)}
	<Form.Field field={formFields.defaultSql} orientation="horizontal">
		<Form.Checkbox defaultChecked={initial.defaultSql} />
		<Form.Label>SQL expression</Form.Label>
		<Form.Description class="w-full pl-6">
			Calculate the default value with SQLite functions, e.g.
			<span class="font-mono">datetime('now')</span>.
		</Form.Description>
	</Form.Field>
{/if}
