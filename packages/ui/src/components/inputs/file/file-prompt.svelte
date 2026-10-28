<script lang="ts">
	import * as Icon from '../../icon/index.js';

	interface Props {
		/** Id of the file input the prompt opens. */
		for: string;
		hint: string;
		disabled?: boolean;
	}

	let { for: forId, hint, disabled = false }: Props = $props();
</script>

<label
	for={forId}
	class={[
		'flex flex-col items-center justify-center gap-2 px-6 py-8 text-center',
		disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-50'
	]}
>
	<span
		class="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-xs [&_svg]:size-5"
	>
		<Icon.Root icon="lucide:upload" />
	</span>
	<span class="text-sm text-zinc-600">
		<strong class="font-medium text-zinc-900 underline underline-offset-4">
			Click to upload
		</strong>
		or drag and drop
	</span>
	<span class="text-xs text-zinc-500">{hint}</span>
</label>
