<script lang="ts">
	import * as Textarea from '@pouchbasejs/ui/inputs/textarea';
</script>

<div class="flex max-w-md flex-col gap-1.5">
	<label for="description" class="text-sm font-medium text-zinc-900">Description</label>
	<Textarea.Root id="description" placeholder="What is this collection for?" />
</div>
