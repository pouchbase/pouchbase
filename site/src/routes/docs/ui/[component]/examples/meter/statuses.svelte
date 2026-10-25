<script lang="ts">
	import * as Meter from '@pouchbasejs/ui/meter';

	const quotas = [
		{ label: 'Storage', value: 1.2, max: 5, unit: 'GB', status: 'ok' },
		{ label: 'Requests', value: 86_000, max: 100_000, unit: 'requests', status: 'warning' },
		{ label: 'Emails', value: 3_100, max: 3_000, unit: 'emails', status: 'exceeded' }
	] as const;
</script>

<div class="flex max-w-sm flex-col gap-4">
	{#each quotas as quota (quota.label)}
		{@const text = `${quota.value.toLocaleString('en')} of ${quota.max.toLocaleString('en')}`}

		<div class="flex flex-col gap-1.5">
			<div class="flex justify-between text-sm">
				<span id="quota-{quota.label}" class="font-medium text-zinc-900">{quota.label}</span>
				<span class="text-zinc-500">{text}</span>
			</div>
			<Meter.Root
				value={quota.value}
				max={quota.max}
				status={quota.status}
				aria-labelledby="quota-{quota.label}"
				aria-valuetext="{text} {quota.unit}"
			/>
		</div>
	{/each}
</div>
