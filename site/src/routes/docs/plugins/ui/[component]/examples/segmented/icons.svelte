<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Segmented from '@pouchbasejs/ui/segmented';

	let layout = $state('grid');
</script>

<Segmented.Root value={layout} onValueChange={(value) => (layout = value)} aria-label="Layout">
	<Segmented.Item value="list" aria-label="List">
		<Icon.Root icon="lucide:list" class="size-4" />
	</Segmented.Item>
	<Segmented.Item value="grid" aria-label="Grid">
		<Icon.Root icon="lucide:layout-grid" class="size-4" />
	</Segmented.Item>
</Segmented.Root>
