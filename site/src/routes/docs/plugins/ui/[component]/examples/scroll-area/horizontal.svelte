<script lang="ts">
	import * as ScrollArea from '@pouchbasejs/ui/scroll-area';

	const fields = ['id', 'title', 'slug', 'author', 'status', 'tags', 'cover', 'created', 'updated'];
</script>

<ScrollArea.Root orientation="horizontal" class="max-w-sm rounded-lg border border-zinc-200">
	<div class="flex w-max gap-2 p-3">
		{#each fields as field (field)}
			<span class="rounded-md bg-zinc-100 px-3 py-1.5 font-mono text-sm text-zinc-700">
				{field}
			</span>
		{/each}
	</div>
</ScrollArea.Root>
