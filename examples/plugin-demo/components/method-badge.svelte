<script lang="ts">
	import type { Method } from '../lib/catalog.js';

	let { method }: { method: Method } = $props();

	const colors: Record<Method, string> = {
		GET: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
		POST: 'bg-sky-50 text-sky-700 ring-sky-600/20'
	};
</script>

<span
	class={[
		'inline-flex h-5 w-12 flex-none items-center justify-center rounded font-mono text-[11px] font-semibold tracking-wide ring-1 ring-inset',
		colors[method]
	]}
>
	{method}
</span>
