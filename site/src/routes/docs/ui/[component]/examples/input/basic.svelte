<script lang="ts">
	import * as Input from '@pouchbasejs/ui/inputs/input';

	let name = $state('');
</script>

<div class="flex max-w-sm flex-col gap-1.5">
	<label for="collection-name" class="text-sm font-medium text-zinc-900">Name</label>
	<Input.Root id="collection-name" placeholder="posts" bind:value={name} />
	<p class="text-xs text-zinc-500">/api/collections/{name || 'posts'}/records</p>
</div>
