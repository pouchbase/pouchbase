<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import * as Sortable from '#lib/components/ui/sortable/index.js';
	import { isPluginFieldType } from '#lib/fields/field-types.js';
	import { listPluginFieldTypes } from '#lib/remote/plugins.remote.js';
	import { updateFieldsSchema } from '#lib/schemas/fields.js';
	import AddFieldDialog from './add-field-dialog.svelte';
	import EditCollectionIndexes from './edit-collection-indexes.svelte';
	import EditComputedDialog from './edit-computed-dialog.svelte';
	import EditFieldDialog from './edit-field-dialog.svelte';
	import FieldRow from './field-row.svelte';
	import { updateFields } from './fields.remote';
	import type { GridField } from './grid';

	type Props = {
		collection: { id: string; name: string };
		fields: GridField[];
		/** Opens the new field dialog as soon as the sheet is open. */
		newField?: boolean;
		onSaved: () => void;
	};

	let { collection, fields, newField = false, onSaved }: Props = $props();

	const dialogs = Dialog.getDialogs();

	// Not awaited: until the plugins' types are in, plugin fields show what they remember of theirs.
	const pluginTypes = $derived(
		fields.some((field) => isPluginFieldType(field.type))
			? listPluginFieldTypes().current
			: undefined
	);

	function toRow(field: GridField) {
		return {
			id: field.id,
			name: field.name,
			required: field.required,
			unique: field.unique,
			hidden: field.hidden,
			remove: false
		};
	}

	const form = $derived.by(() => {
		const key = collection.id;

		return untrack(() => updateFields.for(key).preflight(updateFieldsSchema));
	});

	// The form state is the source of truth while editing: inputs are bound to `fields[index]`, so
	// reordering rewrites the array and the edits move along with their rows.
	untrack(() =>
		form.fields.set({
			collection: collection.name,
			fields: fields.map(toRow)
		})
	);

	const byId = $derived(new Map(fields.map((field) => [field.id, field])));
	// Normalized: an unchecked checkbox is stored as `null`, so moved rows keep their state.
	const edited = $derived(
		(form.fields.fields.value() ?? []).map((row) => ({
			id: row?.id ?? '',
			name: row?.name ?? '',
			required: !!row?.required,
			unique: !!row?.unique,
			hidden: !!row?.hidden,
			remove: !!row?.remove
		}))
	);
	// Fields added by the dialog (saved right away) come last; their inputs fall back to the saved
	// values until edited, and the other rows keep their unsaved edits.
	const rows = $derived([
		...edited,
		...fields.filter((field) => !edited.some((row) => row.id === field.id)).map(toRow)
	]);
	const removed = $derived(rows.filter((row) => row.remove).length);

	// Opens on top of the sheet, which stays open behind it.
	function addField() {
		void dialogs.open(AddFieldDialog, { collection, fields });
	}

	// Saved right away, like a new field; the other rows keep their unsaved edits.
	function editComputation(field: GridField) {
		void dialogs.open(EditComputedDialog, { collection, field, fields });
	}

	// Default value and the settings of the type; also saved right away.
	function editSettings(field: GridField) {
		void dialogs.open(EditFieldDialog, { collection, field });
	}

	onMount(() => {
		if (newField) {
			addField();
		}
	});

	function reorder(from: number, to: number) {
		const next = [...rows];
		const [row] = next.splice(from, 1);

		next.splice(to, 0, row);
		form.fields.fields.set(next);
	}
</script>

<Form.Root
	{form}
	success="Fields saved"
	class="min-h-0 flex-1 gap-0"
	enhance={async (instance) => {
		if (await instance.submit()) {
			onSaved();
		}
	}}
>
	<Form.Hidden field={form.fields.collection} value={collection.name} />

	<Sheet.Body>
		{#if rows.length}
			<Sortable.Root count={rows.length} onReorder={reorder} aria-label="Fields">
				{#snippet header()}
					<!-- Same widths and gaps as the rows below. -->
					<span class="w-6"></span>
					<span class="w-8"></span>
					<span class="flex-1">Field</span>
					<span class="w-16 text-center">Required</span>
					<span class="w-16 text-center">Unique</span>
					<span
						class="w-16 text-center"
						title="Only admins, API keys and API rules see hidden fields">Hidden</span
					>
					<span class="w-16"></span>
				{/snippet}

				{#each rows as row, index (row.id)}
					{@const field = byId.get(row.id)}

					{#if field}
						<FieldRow
							{form}
							{index}
							{field}
							{row}
							{pluginTypes}
							onEditSettings={editSettings}
							onEditComputation={editComputation}
						/>
					{/if}
				{/each}
			</Sortable.Root>

			<Button.Root variant="secondary" class="self-start" onclick={addField}>
				<Icon.Root icon="lucide:plus" />
				New field
			</Button.Root>
		{:else}
			<Empty.Root>
				<Empty.Icon><Icon.Root icon="lucide:columns-3" /></Empty.Icon>
				<Empty.Title>No fields yet</Empty.Title>
				<Empty.Description>Fields are the columns of this collection.</Empty.Description>
				<Button.Root onclick={addField}>
					<Icon.Root icon="lucide:plus" />
					New field
				</Button.Root>
			</Empty.Root>
		{/if}

		<EditCollectionIndexes {collection} {fields} />
	</Sheet.Body>

	<Sheet.Footer>
		{#if removed}
			<p class="mr-auto text-sm text-red-600">
				Saving deletes {removed === 1 ? '1 field' : `${removed} fields`} and their data.
			</p>
		{/if}

		<Sheet.Close>Cancel</Sheet.Close>
		<Form.Submit>Save</Form.Submit>
	</Sheet.Footer>
</Form.Root>
