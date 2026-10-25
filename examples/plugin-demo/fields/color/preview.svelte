<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	let { value }: FieldPreviewProps<string> = $props();
</script>

{#if value !== null}
	<span
		class="inline-flex h-5.5 items-center gap-1.5 rounded-full border border-zinc-200 bg-white pr-2 pl-1 font-mono text-xs tracking-wider text-zinc-700 uppercase"
		title={value}
	>
		<span
			class="size-3.5 rounded-full inset-ring inset-ring-black/10"
			style:background-color={value}
			aria-hidden="true"
		></span>
		{value.slice(1)}
	</span>
{/if}
