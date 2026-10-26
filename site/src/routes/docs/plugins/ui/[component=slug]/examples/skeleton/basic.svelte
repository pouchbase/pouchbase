<script lang="ts">
	import * as Skeleton from '@pouchbasejs/ui/skeleton';
</script>

<div
	class="flex max-w-sm items-center gap-4 rounded-xl border border-zinc-200 p-4"
	aria-busy="true"
>
	<Skeleton.Root class="size-10 rounded-full" />
	<div class="flex flex-1 flex-col gap-2">
		<Skeleton.Root class="h-4 w-1/2" />
		<Skeleton.Root class="h-3 w-3/4" />
	</div>
</div>
