<script lang="ts">
	import { untrack } from 'svelte';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import type { SignInMethod } from '#lib/auth/sign-in-methods.js';
	import { USERS_COLLECTION } from '#lib/auth/users.js';
	import { FILES_COLLECTION, MANAGED_FILE_FIELDS, MAX_FILE_SIZE } from '#lib/files/files.js';
	import { isAutoType } from '#lib/fields/field-types.js';
	import {
		formatTimestamp,
		lastUpdated,
		pluginTypeOf,
		type GridField,
		type GridRecord,
		type PluginType
	} from './grid';
	import RecordFieldInput from './record-field-input.svelte';
	import RecordFileField from './record-file-field.svelte';
	import RecordFileSummary from './record-file-summary.svelte';
	import RecordSignInList from './record-sign-in-list.svelte';
	import { saveRecord } from './records.remote';

	type Props = {
		collection: { name: string };
		fields: GridField[];
		/** The record to edit; `null` creates a new one. */
		record: GridRecord | null;
		/** Name of the collection each relation field points to, keyed by field name. */
		relationTargets?: Record<string, string>;
		/** Only for the built-in `users` collection: how this user can sign in. */
		signInMethods?: SignInMethod[];
		/** The installed plugin field types, for fields with a plugin's type. */
		pluginTypes?: PluginType[];
		open?: boolean;
		onDelete: (id: string) => void;
		/** Only for images in the built-in `files` collection. */
		onEditImage?: (record: GridRecord) => void;
	};

	let {
		collection,
		fields,
		record,
		relationTargets = {},
		signInMethods = [],
		pluginTypes = [],
		open = $bindable(false),
		onDelete,
		onEditImage
	}: Props = $props();

	// A separate form instance per record, so values and issues don't leak between records.
	const form = $derived.by(() => {
		const key = record?._key ?? 'new';

		return untrack(() => saveRecord.for(key));
	});

	const isFiles = $derived(collection.name === FILES_COLLECTION);
	// The id and timestamps are filled in automatically. In `files`, the type, size and storage key
	// are managed by the upload, not the form.
	const editableFields = $derived(
		fields.filter(
			(field) => !isAutoType(field.type) && !(isFiles && MANAGED_FILE_FIELDS.has(field.name))
		)
	);
	const updated = $derived(record ? lastUpdated(record, fields) : undefined);

	/**
	 * File fields (e.g. a user's avatar) and single relations to `files` get a file picker with an
	 * upload.
	 */
	function isFileField(field: GridField) {
		return (
			field.type === 'file' ||
			(field.type === 'relation' &&
				!field.options.multiple &&
				relationTargets[field.name] === FILES_COLLECTION)
		);
	}

	const hasUploads = $derived(isFiles || editableFields.some(isFileField));
</script>

<Sheet.Root bind:open>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>{record ? 'Edit record' : 'New record'}</Sheet.Title>
			<Sheet.Description>
				{#if record}
					<span class="font-mono">{record._key}</span>
					{#if updated !== undefined}
						· updated {formatTimestamp(updated)} UTC
					{/if}
				{:else}
					Adds a row to <span class="font-mono">{collection.name}</span>
				{/if}
			</Sheet.Description>
		</Sheet.Header>

		<!-- Inputs take their value once, so a link to another record rebuilds the form. -->
		{#key record?._key}
			<Form.Root
				{form}
				success={record ? 'Record saved' : 'Record created'}
				enctype={hasUploads ? 'multipart/form-data' : undefined}
				class="min-h-0 flex-1 gap-0"
				enhance={async (instance) => {
					if (await instance.submit()) {
						instance.element.reset();
						open = false;
					}
				}}
			>
				<Form.Hidden field={form.fields.collection} value={collection.name} />
				<Form.Hidden field={form.fields.id} value={record?._key ?? ''} />

				<Sheet.Body>
					{#if isFiles}
						{#if record}
							<RecordFileSummary {record} version={updated} {onEditImage} />
						{/if}

						<Form.Field field={form.fields._file}>
							<Form.Label class="font-mono">file</Form.Label>
							<Form.File maxSize={MAX_FILE_SIZE} />
							{#if record}
								<Form.Description>Upload a new file to replace this one.</Form.Description>
							{/if}
							<Form.Errors />
						</Form.Field>
					{/if}

					{#each editableFields as field (field.id)}
						{#if isFileField(field)}
							<RecordFileField
								{field}
								formField={form.fields.values[field.name]}
								uploadField={form.fields._uploads[field.name]}
								value={record?.[field.name]}
							/>
						{:else}
							<RecordFieldInput
								{field}
								formField={form.fields.values[field.name]}
								value={record?.[field.name]}
								relationTarget={relationTargets[field.name]}
								pluginType={pluginTypeOf(field, pluginTypes)}
							/>
						{/if}
					{:else}
						<p class="text-sm text-zinc-500">
							This collection has no fields to fill in yet. Saving creates a record with only its
							automatic values.
						</p>
					{/each}

					{#if collection.name === USERS_COLLECTION && record}
						<RecordSignInList methods={signInMethods} />
					{/if}

					{#if collection.name === USERS_COLLECTION}
						<Form.Field field={form.fields._password}>
							<Form.Label class="font-mono">password</Form.Label>
							<Form.Input type="password" autocomplete="new-password" />
							<Form.Description>
								{record
									? 'Leave empty to keep the current password.'
									: 'Lets the user sign in with their email and this password.'}
							</Form.Description>
							<Form.Errors />
						</Form.Field>
					{/if}
				</Sheet.Body>

				<Sheet.Footer>
					{#if record}
						<Button.Root
							type="button"
							variant="ghost"
							class="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700"
							onclick={() => onDelete(record._key)}
						>
							<Icon.Root icon="lucide:trash-2" />
							Delete
						</Button.Root>
					{/if}

					<Sheet.Close>Cancel</Sheet.Close>
					<Form.Submit>{record ? 'Save changes' : 'Create record'}</Form.Submit>
				</Sheet.Footer>
			</Form.Root>
		{/key}
	</Sheet.Content>
</Sheet.Root>
