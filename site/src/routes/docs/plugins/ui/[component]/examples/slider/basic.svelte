<script lang="ts">
	import * as Slider from '@pouchbasejs/ui/inputs/slider';

	let quality = $state(80);
</script>

<div class="flex max-w-xs flex-col gap-1">
	<div class="flex justify-between text-sm">
		<span id="quality" class="font-medium text-zinc-900">Image quality</span>
		<span class="text-zinc-500">{quality}%</span>
	</div>
	<Slider.Root bind:value={quality} min={10} max={100} step={5} aria-labelledby="quality" />
</div>
