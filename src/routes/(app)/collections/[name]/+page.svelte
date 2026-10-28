<script lang="ts">
	import { page } from '$app/state';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { USERS_COLLECTION } from '#lib/auth/users.js';
	import { isAutoType, isPluginFieldType } from '#lib/fields/field-types.js';
	import { listPluginFieldTypes } from '#lib/remote/plugins.remote.js';
	import { FILES_COLLECTION, fileUrl, isInlineImage } from '#lib/files/files.js';
	import { previewThumbnail } from '#lib/files/thumbnails.js';
	import { RealtimeCollection } from '#lib/realtime/collection.svelte.js';
	import { getCollection } from '../../collections.remote';
	import ApiSheet from './api-sheet.svelte';
	import CollectionSettingsSheet from './collection-settings-sheet.svelte';
	import { getCollectionSettings } from './collection-settings.remote';
	import CollectionTopbar from './collection-topbar.svelte';
	import DeleteRecordsDialog from './delete-records-dialog.svelte';
	import EditCollectionSheet from './edit-collection-sheet.svelte';
	import FilesGallery from './files-gallery.svelte';
	import {
		fieldColumn,
		PREVIEW_COLUMN,
		lastUpdated,
		SIGN_IN_COLUMN,
		type GridField,
		type GridRecord
	} from './grid';
	import GridFooter from './grid-footer.svelte';
	import ImageEditorDialog from './image-editor-dialog.svelte';
	import RecordSheet from './record-sheet.svelte';
	import RecordsGrid from './records-grid.svelte';
	import { RecordsPage } from './records-page.svelte';
	import { listRecords } from './records.remote';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	// URL params, the selection and the record sheet; `records` is only read once it's loaded.
	const recordsPage = new RecordsPage(
		() => params.name,
		(): GridRecord[] => records
	);

	const [collection, data, settings] = $derived(
		await Promise.all([
			getCollection(params.name),
			listRecords(recordsPage.args),
			getCollectionSettings(params.name)
		])
	);

	const fields = $derived(data.fields as GridField[]);
	const records = $derived(data.items as GridRecord[]);
	const isUsers = $derived(collection.system && collection.name === USERS_COLLECTION);
	const isFiles = $derived(collection.system && collection.name === FILES_COLLECTION);
	const relationTargets = $derived(data.relationTargets ?? {});
	// Only collections with plugin fields need the plugins' types (for their components).
	const pluginTypes = $derived(
		fields.some((field) => isPluginFieldType(field.type)) ? await listPluginFieldTypes() : []
	);
	const fieldColumns = $derived(
		fields.map((field) => ({
			...fieldColumn(field, pluginTypes),
			relationTarget: relationTargets[field.name],
			fileSize: isFiles && field.name === 'size'
		}))
	);
	// Virtual columns of built-in collections go after the leading id and timestamp fields.
	const leading = $derived.by(() => {
		const index = fields.findIndex((field) => !isAutoType(field.type));

		return index === -1 ? fields.length : index;
	});
	const columns = $derived([
		...fieldColumns.slice(0, leading),
		...(isUsers ? [SIGN_IN_COLUMN] : []),
		...(isFiles ? [PREVIEW_COLUMN] : []),
		...fieldColumns.slice(leading)
	]);
	const signInMethods = $derived(data.signInMethods ?? {});

	// Changes by anyone (the API, other admins, functions) refresh the page of records.
	const realtime = new RealtimeCollection(
		() => params.name,
		() => void listRecords(recordsPage.args).refresh()
	);

	// `files` can be shown as a grid of large previews; the layout lives in the URL too.
	const view = $derived(isFiles && page.url.searchParams.get('view') === 'grid' ? 'grid' : 'table');
	// Use a configured thumbnail size close to the preview's size, if there is one.
	const smallPreview = $derived(previewThumbnail(settings.thumbnails, 48));
	const largePreview = $derived(previewThumbnail(settings.thumbnails, 400));

	function previewUrl(record: GridRecord, size: 'sm' | 'lg') {
		const thumb = size === 'sm' ? smallPreview : largePreview;

		return isInlineImage(String(record.mime_type ?? ''))
			? fileUrl(record._key, { thumb, version: lastUpdated(record, fields) })
			: null;
	}

	const dialogs = Dialog.getDialogs();

	let settingsOpen = $state(false);
	let apiOpen = $state(false);
	// The edit collection sheet, optionally starting with the new field dialog (the add button in the
	// grid header). Also opened by navigating here with `editCollection` state, after creating it.
	let editor = $derived<'fields' | 'new-field' | null>(page.state.editCollection ? 'fields' : null);

	function editCollection(newField = false) {
		editor = newField ? 'new-field' : 'fields';
	}

	const editing = $derived(recordsPage.editing);

	// Opens on top of the record sheet, which stays open behind it.
	function editImage(record: GridRecord) {
		void dialogs.open(ImageEditorDialog, {
			file: {
				id: record._key,
				name: String(record.name ?? ''),
				mimeType: String(record.mime_type ?? ''),
				// `files` always has its `updated_at` field; it is built-in.
				version: lastUpdated(record, fields) ?? 0
			}
		});
	}

	async function confirmDelete(ids: string[]) {
		if (await dialogs.open(DeleteRecordsDialog, { collection, ids })) {
			for (const id of ids) {
				recordsPage.selection.delete(id);
			}

			recordsPage.sheetOpen = false;
		}
	}
</script>

<svelte:head>
	<title>{collection.name} · Collections</title>
</svelte:head>

<CollectionTopbar
	name={params.name}
	{collection}
	realtime={realtime.state}
	selected={recordsPage.selectedIds}
	onClearSelection={() => recordsPage.selection.clear()}
	onDeleteSelected={() => void confirmDelete(recordsPage.selectedIds)}
	onNewRecord={() => recordsPage.openRecord(null)}
	onOpenSettings={() => (settingsOpen = true)}
	onOpenApi={() => (apiOpen = true)}
	onEditCollection={() => editCollection()}
	{view}
	onViewChange={isFiles
		? (next) => void recordsPage.navigate({ view: next === 'grid' ? 'grid' : null })
		: undefined}
/>

{#if view === 'grid'}
	<FilesGallery {records} state={recordsPage} previewUrl={(record) => previewUrl(record, 'lg')} />
{:else}
	<RecordsGrid
		{collection}
		{fields}
		{columns}
		{records}
		state={recordsPage}
		sort={data.sort}
		order={data.order}
		{signInMethods}
		{previewUrl}
		onAddField={() => editCollection(true)}
	/>
{/if}

<GridFooter
	total={data.total}
	page={data.page}
	perPage={data.perPage}
	onPage={(next) => recordsPage.navigate({ page: next })}
/>

<RecordSheet
	{collection}
	{fields}
	record={editing}
	{relationTargets}
	{pluginTypes}
	signInMethods={editing
		? (signInMethods[editing._key] ?? recordsPage.openedSignInMethods)
		: undefined}
	bind:open={() => recordsPage.sheetVisible, recordsPage.setSheetOpen}
	onDelete={(id) => void confirmDelete([id])}
	onEditImage={isFiles ? editImage : undefined}
/>

<CollectionSettingsSheet {collection} bind:open={settingsOpen} />

<ApiSheet {collection} {fields} {relationTargets} rules={settings.rules} bind:open={apiOpen} />

<EditCollectionSheet
	{collection}
	{fields}
	newField={editor === 'new-field'}
	bind:open={() => editor !== null, (open) => (editor = open ? (editor ?? 'fields') : null)}
/>
