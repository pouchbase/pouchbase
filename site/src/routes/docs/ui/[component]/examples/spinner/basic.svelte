<script lang="ts">
	import * as Spinner from '@pouchbasejs/ui/spinner';
</script>

<div class="flex items-center gap-6 text-zinc-700">
	<Spinner.Root label="Loading" />
	<Spinner.Root label="Loading" class="size-6" />
	<span class="inline-flex items-center gap-2 text-sm text-zinc-500">
		<Spinner.Root />
		Syncing records…
	</span>
</div>
