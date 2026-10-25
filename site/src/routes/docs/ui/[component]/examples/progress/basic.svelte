<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Progress from '@pouchbasejs/ui/progress';

	const total = 40;

	let moved = $state(12);
</script>

<div class="flex max-w-sm flex-col gap-3">
	<div class="flex justify-between text-sm">
		<span id="move-files" class="font-medium text-zinc-900">Moving files</span>
		<span class="text-zinc-500">{moved} of {total}</span>
	</div>
	<Progress.Root
		value={moved}
		max={total}
		aria-labelledby="move-files"
		aria-valuetext="{moved} of {total} files"
	/>
	<div>
		<Button.Root variant="secondary" onclick={() => (moved = moved >= total ? 0 : moved + 4)}>
			{moved >= total ? 'Start over' : 'Move 4 more'}
		</Button.Root>
	</div>
</div>
