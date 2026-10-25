<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';

	function backup() {
		return new Promise((done) => setTimeout(done, 2000));
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	<Button.Root onclick={backup}>Back up now</Button.Root>
	<Button.Root variant="secondary" size="icon" aria-label="Sync" onclick={backup}>
		<Icon.Root icon="lucide:refresh-cw" />
	</Button.Root>
	<Button.Root variant="secondary" loading>Saving</Button.Root>
</div>
