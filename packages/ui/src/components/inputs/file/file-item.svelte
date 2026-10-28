<script lang="ts">
	import { formatFileSize } from '../../../format.js';
	import * as Button from '../../button/index.js';
	import * as Icon from '../../icon/index.js';
	import * as Thumbnail from '../../thumbnail/index.js';
	import { iconFor } from './file-utils.js';

	interface Props {
		file: File;
		/** Object URL of an image preview, or null for an icon. */
		preview: string | null;
		disabled?: boolean;
		onremove: () => void;
	}

	let { file, preview, disabled = false, onremove }: Props = $props();
</script>

<li class="flex items-center gap-3 p-3">
	<Thumbnail.Root src={preview} alt="">
		<Icon.Root icon={iconFor(file.type)} />
	</Thumbnail.Root>

	<div class="flex min-w-0 flex-1 flex-col">
		<span class="truncate text-sm font-medium text-zinc-900" title={file.name}>
			{file.name}
		</span>
		<span class="truncate text-xs text-zinc-500">
			{formatFileSize(file.size)}{file.type ? ` · ${file.type}` : ''}
		</span>
	</div>

	<Button.Root
		type="button"
		variant="ghost"
		size="icon"
		aria-label={`Remove ${file.name}`}
		{disabled}
		onclick={onremove}
	>
		<Icon.Root icon="lucide:x" />
	</Button.Root>
</li>
