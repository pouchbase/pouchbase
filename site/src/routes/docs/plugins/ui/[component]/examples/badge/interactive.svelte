<script lang="ts">
	import * as Badge from '@pouchbasejs/ui/badge';
	import * as Icon from '@pouchbasejs/ui/icon';

	let filters = $state(2);
</script>

<div class="flex flex-wrap items-center gap-2">
	<Badge.Root variant="success">
		<Icon.Root icon="lucide:check" />
		Verified
	</Badge.Root>
	<Badge.Root variant="outline" href="https://pouchbase.io/docs">
		<Icon.Root icon="lucide:link" />
		posts/k3x9a2
	</Badge.Root>
	<Badge.Root onclick={() => (filters = 0)}>
		{filters} filters
		<Icon.Root icon="lucide:x" />
	</Badge.Root>
</div>
