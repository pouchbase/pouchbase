<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';

	const droplet = `data:image/svg+xml,${encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2c4 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 3-7 7-12Z"/></svg>'
	)}`;
</script>

<div class="flex items-center gap-4">
	<Icon.Root src={droplet} class="size-6 text-chart-1" />
	<span class="inline-flex items-center gap-1.5 text-sm text-zinc-700">
		<Icon.Root src={droplet} />
		Color
	</span>
</div>
