<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';
</script>

<div class="flex flex-wrap items-center gap-2">
	<Button.Root>
		<Icon.Root icon="lucide:plus" />
		New record
	</Button.Root>
	<Button.Root variant="secondary" href="https://pouchbase.io/docs">
		Docs
		<Icon.Root icon="lucide:arrow-up-right" />
	</Button.Root>
	<Button.Root variant="secondary" size="icon" aria-label="Refresh">
		<Icon.Root icon="lucide:refresh-cw" />
	</Button.Root>
	<span class="inline-flex items-center gap-1 text-sm text-zinc-700">
		#f6821f
		<Button.Root variant="ghost" size="icon-sm" aria-label="Reset color">
			<Icon.Root icon="lucide:rotate-ccw" />
		</Button.Root>
	</span>
</div>
