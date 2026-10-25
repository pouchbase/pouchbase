<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Tooltip from '@pouchbasejs/ui/tooltip';
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button.Root {...props} variant="secondary" size="icon" aria-label="Copy id">
				<Icon.Root icon="lucide:copy" />
			</Button.Root>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content>Copy id</Tooltip.Content>
</Tooltip.Root>
