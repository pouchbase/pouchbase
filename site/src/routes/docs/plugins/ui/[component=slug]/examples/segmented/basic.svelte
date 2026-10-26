<script lang="ts">
	import * as Segmented from '@pouchbasejs/ui/segmented';

	let period = $state('week');
</script>

<div class="flex flex-col items-start gap-3">
	<Segmented.Root value={period} onValueChange={(value) => (period = value)} aria-label="Period">
		<Segmented.Item value="day">Day</Segmented.Item>
		<Segmented.Item value="week">Week</Segmented.Item>
		<Segmented.Item value="month">Month</Segmented.Item>
		<Segmented.Item value="year">Year</Segmented.Item>
	</Segmented.Root>
	<p class="text-sm text-zinc-500">Requests per {period}</p>
</div>
