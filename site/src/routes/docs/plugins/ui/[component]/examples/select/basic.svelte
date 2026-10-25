<script lang="ts">
	import * as Select from '@pouchbasejs/ui/inputs/select';

	const rules = [
		{ value: 'public', label: 'Anyone' },
		{ value: 'users', label: 'Signed-in users' },
		{ value: 'owner', label: 'The owner' },
		{ value: 'admins', label: 'Admins only' }
	];

	let rule = $state('');
</script>

<div class="flex max-w-xs flex-col gap-1.5">
	<span id="view-rule" class="text-sm font-medium text-zinc-900">Who can view records</span>
	<Select.Root
		items={rules}
		bind:value={rule}
		aria-labelledby="view-rule"
		placeholder="Pick a rule"
	/>
</div>
