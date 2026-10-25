<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Thumbnail from '@pouchbasejs/ui/thumbnail';
</script>

<div class="flex items-end gap-3">
	<Thumbnail.Root src="/docs/ui/landscape.svg" alt="Landscape" size="sm" />
	<Thumbnail.Root src="/docs/ui/portrait.svg" alt="Avatar" />
	<Thumbnail.Root src="/docs/ui/landscape.svg" alt="Landscape" size="lg" />
	<Thumbnail.Root>
		<Icon.Root icon="lucide:file-text" />
	</Thumbnail.Root>
</div>
