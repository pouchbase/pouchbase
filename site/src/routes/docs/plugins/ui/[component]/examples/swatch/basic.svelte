<script lang="ts">
	import * as Swatch from '@pouchbasejs/ui/swatch';

	const presets = [
		{ name: 'Original', filter: undefined },
		{ name: 'Mono', filter: 'grayscale(1)' },
		{ name: 'Warm', filter: 'sepia(0.6) saturate(1.4)' },
		{ name: 'Cool', filter: 'hue-rotate(160deg)' }
	];

	let selected = $state('Original');
</script>

<div class="grid max-w-sm grid-cols-4 gap-2">
	{#each presets as preset (preset.name)}
		<Swatch.Root
			src="/docs/ui/landscape.svg"
			filter={preset.filter}
			selected={selected === preset.name}
			onclick={() => (selected = preset.name)}
		>
			{preset.name}
		</Swatch.Root>
	{/each}
</div>
