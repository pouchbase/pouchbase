<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as DataGrid from '#lib/components/ui/data-grid/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Checkbox from '#lib/components/ui/inputs/checkbox/index.js';
	import * as Thumbnail from '#lib/components/ui/thumbnail/index.js';
	import type { SignInMethod } from '#lib/auth/sign-in-methods.js';
	import type { getCollection } from '../../collections.remote';
	import ColumnHeader from './column-header.svelte';
	import DeleteFieldDialog from './delete-field-dialog.svelte';
	import EditComputedDialog from './edit-computed-dialog.svelte';
	import type { GridColumn, GridField, GridRecord } from './grid';
	import RecordCell from './record-cell.svelte';
	import type { RecordsPage } from './records-page.svelte';
	import RenameFieldDialog from './rename-field-dialog.svelte';
	import SignInMethods from './sign-in-methods.svelte';

	type Props = {
		collection: Awaited<ReturnType<typeof getCollection>>;
		fields: GridField[];
		columns: GridColumn[];
		records: GridRecord[];
		state: RecordsPage;
		/** The sorted column and its direction. */
		sort?: string;
		order?: 'asc' | 'desc';
		/** Only for the built-in `users` collection, keyed by record id. */
		signInMethods: Record<string, SignInMethod[]>;
		/** URL of a small (`sm`) or large (`lg`) preview of a file, `null` if it isn't an image. */
		previewUrl: (record: GridRecord, size: 'sm' | 'lg') => string | null;
		onAddField: () => void;
	};

	let {
		collection,
		fields,
		columns,
		records,
		state,
		sort,
		order,
		signInMethods,
		previewUrl,
		onAddField
	}: Props = $props();

	const dialogs = Dialog.getDialogs();
</script>

<!-- Paging and sorting keep the current rows on screen (dimmed) until the new ones are in. -->
<DataGrid.Root aria-label="Records of {collection.name}" busy={$effect.pending() > 0}>
	<DataGrid.Header>
		<DataGrid.Head class="w-10">
			<Checkbox.Root
				checked={state.allSelected}
				indeterminate={state.selectedIds.length > 0 && !state.allSelected}
				disabled={!records.length}
				aria-label="Select all records on this page"
				onchange={state.toggleAll}
			/>
		</DataGrid.Head>

		{#each columns as column (column.name)}
			<DataGrid.Head class="min-w-40">
				<ColumnHeader
					{column}
					sorted={sort === column.name ? order : undefined}
					onSort={(next) => state.navigate({ sort: column.name, order: next, page: null })}
					onRename={() => {
						if (column.field) {
							void dialogs.open(RenameFieldDialog, { collection, field: column.field });
						}
					}}
					onEditComputation={() => {
						if (column.field) {
							void dialogs.open(EditComputedDialog, { collection, field: column.field, fields });
						}
					}}
					onDelete={() => {
						if (column.field) {
							void dialogs.open(DeleteFieldDialog, { collection, field: column.field });
						}
					}}
				/>
			</DataGrid.Head>
		{/each}

		<DataGrid.Head class="w-10 px-0">
			<Button.Root
				variant="ghost"
				size="icon"
				class="rounded-none"
				aria-label="Add field"
				onclick={onAddField}
			>
				<Icon.Root icon="lucide:plus" />
			</Button.Root>
		</DataGrid.Head>
	</DataGrid.Header>

	<DataGrid.Body>
		{#each records as record (record._key)}
			<DataGrid.Row
				selected={state.selection.has(record._key)}
				onclick={() => state.openRecord(record)}
			>
				<DataGrid.Cell class="w-10" onclick={(event) => event.stopPropagation()}>
					<Checkbox.Root
						checked={state.selection.has(record._key)}
						aria-label="Select record {record._key}"
						onchange={() => state.toggle(record._key)}
					/>
				</DataGrid.Cell>

				{#each columns as column (column.name)}
					<DataGrid.Cell>
						{#if column.virtual === 'sign-in'}
							<SignInMethods methods={signInMethods[record._key] ?? []} />
						{:else if column.virtual === 'preview'}
							<Thumbnail.Root
								src={previewUrl(record, 'sm')}
								preview={previewUrl(record, 'lg')}
								alt={String(record.name ?? '')}
								size="sm"
							>
								<Icon.Root icon="lucide:file" />
							</Thumbnail.Root>
						{:else}
							<RecordCell {column} value={record[column.name]} />
						{/if}
					</DataGrid.Cell>
				{/each}

				<DataGrid.Cell></DataGrid.Cell>
			</DataGrid.Row>
		{:else}
			<DataGrid.Empty columns={columns.length + 2}>
				No records yet.
				<Button.Root variant="secondary" class="ml-2" onclick={() => state.openRecord(null)}>
					<Icon.Root icon="lucide:plus" />
					New record
				</Button.Root>
			</DataGrid.Empty>
		{/each}
	</DataGrid.Body>
</DataGrid.Root>
