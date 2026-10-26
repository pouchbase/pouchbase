<script lang="ts">
	import * as ScrollArea from '@pouchbasejs/ui/scroll-area';

	const events = Array.from({ length: 30 }, (_, index) => `record.updated #${30 - index}`);
</script>

<ScrollArea.Root viewportClass="max-h-48" class="max-w-xs rounded-lg border border-zinc-200">
	<ul class="divide-y divide-zinc-100 text-sm text-zinc-700">
		{#each events as event (event)}
			<li class="px-3 py-2 font-mono">{event}</li>
		{/each}
	</ul>
</ScrollArea.Root>
