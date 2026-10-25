<script module lang="ts">
	export type Status = 'ok' | 'warning' | 'error' | 'loading';
</script>

<script lang="ts">
	let { status }: { status: Status } = $props();

	const colors: Record<Status, string> = {
		ok: 'bg-emerald-500',
		warning: 'bg-amber-500',
		error: 'bg-red-500',
		loading: 'bg-zinc-300'
	};
</script>

<!-- A coloured dot; a healthy or loading one pulses. -->
<span class="relative flex size-2.5 flex-none" aria-hidden="true">
	{#if status === 'ok' || status === 'loading'}
		<span
			class={[
				'absolute inline-flex size-full animate-ping rounded-full opacity-60',
				colors[status]
			]}
		></span>
	{/if}
	<span class={['relative inline-flex size-2.5 rounded-full', colors[status]]}></span>
</span>
