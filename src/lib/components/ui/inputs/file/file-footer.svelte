<script lang="ts">
	interface Props {
		/** Id of the file input the action opens. */
		for: string;
		hint: string;
		multiple?: boolean;
		disabled?: boolean;
	}

	let { for: forId, hint, multiple = false, disabled = false }: Props = $props();
</script>

<div
	class="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500"
>
	<span class="truncate">{hint}</span>
	<label
		for={forId}
		class={[
			'shrink-0 font-medium text-zinc-900 underline-offset-4',
			disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:underline'
		]}
	>
		{multiple ? 'Add files' : 'Replace'}
	</label>
</div>
