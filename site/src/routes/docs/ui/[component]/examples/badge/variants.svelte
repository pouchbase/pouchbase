<script lang="ts">
	import * as Badge from '@pouchbasejs/ui/badge';
</script>

<div class="flex flex-wrap items-center gap-2">
	<Badge.Root>Draft</Badge.Root>
	<Badge.Root variant="outline">text</Badge.Root>
	<Badge.Root variant="success">Published</Badge.Root>
	<Badge.Root variant="warning">Expires soon</Badge.Root>
	<Badge.Root variant="danger">Failed</Badge.Root>
</div>
