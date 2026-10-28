<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Thumbnail from '#lib/components/ui/thumbnail/index.js';
	import { fileUrl, formatFileSize, isEditableImage, isInlineImage } from '#lib/files/files.js';
	import type { GridRecord } from './grid';

	type Props = {
		/** A record of the built-in `files` collection. */
		record: GridRecord;
		/** When the file was last updated, so the preview isn't cached across edits. */
		version?: number | string;
		onEditImage?: (record: GridRecord) => void;
	};

	let { record, version, onEditImage }: Props = $props();
</script>

<div class="flex items-center gap-4">
	<Thumbnail.Root
		src={isInlineImage(String(record.mime_type ?? '')) ? fileUrl(record._key, { version }) : null}
		alt={String(record.name ?? '')}
		size="lg"
	>
		<Icon.Root icon="lucide:file" />
	</Thumbnail.Root>

	<div class="flex min-w-0 flex-col gap-1 text-sm">
		<span class="truncate font-medium text-zinc-900">{record.name}</span>
		<span class="text-zinc-500">
			{record.mime_type} · {formatFileSize(Number(record.size ?? 0))}
		</span>
		<Button.Root
			href={fileUrl(record._key, { download: true })}
			variant="secondary"
			class="self-start"
		>
			<Icon.Root icon="lucide:download" />
			Download
		</Button.Root>

		{#if onEditImage && isEditableImage(String(record.mime_type ?? ''))}
			<Button.Root
				type="button"
				variant="secondary"
				class="self-start"
				onclick={() => onEditImage(record)}
			>
				<Icon.Root icon="lucide:pencil" />
				Edit image
			</Button.Root>
		{/if}
	</div>
</div>
