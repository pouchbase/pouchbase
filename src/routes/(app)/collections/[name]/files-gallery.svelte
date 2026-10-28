<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Gallery from '#lib/components/ui/gallery/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Thumbnail from '#lib/components/ui/thumbnail/index.js';
	import { formatFileSize } from '#lib/files/files.js';
	import type { GridRecord } from './grid';
	import type { RecordsPage } from './records-page.svelte';

	type Props = {
		records: GridRecord[];
		state: RecordsPage;
		/** URL of a large preview of the file, or `null` if it isn't an inline image. */
		previewUrl: (record: GridRecord) => string | null;
	};

	let { records, state, previewUrl }: Props = $props();
</script>

<Gallery.Root aria-label="Files">
	{#each records as record (record._key)}
		<Gallery.Item selected={state.selection.has(record._key)}>
			<Gallery.Button onclick={() => state.openRecord(record)}>
				<Thumbnail.Root src={previewUrl(record)} alt={String(record.name ?? '')} size="fill">
					<Icon.Root icon="lucide:file" />
				</Thumbnail.Root>
				<Gallery.Label>{record.name}</Gallery.Label>
				<Gallery.Meta>
					{record.mime_type} · {formatFileSize(Number(record.size ?? 0))}
				</Gallery.Meta>
			</Gallery.Button>
			<Gallery.Check
				checked={state.selection.has(record._key)}
				aria-label="Select {record.name}"
				onchange={() => state.toggle(record._key)}
			/>
		</Gallery.Item>
	{:else}
		<li class="col-span-full py-12 text-center text-sm text-zinc-500">
			No files yet.
			<Button.Root variant="secondary" class="ml-2" onclick={() => state.openRecord(null)}>
				<Icon.Root icon="lucide:plus" />
				Upload a file
			</Button.Root>
		</li>
	{/each}
</Gallery.Root>
