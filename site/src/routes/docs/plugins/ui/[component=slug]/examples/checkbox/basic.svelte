<script lang="ts">
	import * as Checkbox from '@pouchbasejs/ui/inputs/checkbox';

	let required = $state(true);
</script>

<div class="flex flex-col gap-3 text-sm text-zinc-700">
	<label class="flex items-center gap-2">
		<Checkbox.Root bind:checked={required} />
		Required
	</label>
	<label class="flex items-center gap-2">
		<Checkbox.Root />
		Unique
	</label>
	<label class="flex items-center gap-2 text-zinc-400">
		<Checkbox.Root checked disabled />
		System field
	</label>
	<p class="text-zinc-500">The field is {required ? 'required' : 'optional'}.</p>
</div>
