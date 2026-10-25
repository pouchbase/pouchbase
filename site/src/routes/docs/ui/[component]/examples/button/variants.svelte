<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
</script>

<div class="flex flex-wrap items-center gap-2">
	<Button.Root>Save</Button.Root>
	<Button.Root variant="secondary">Cancel</Button.Root>
	<Button.Root variant="ghost">Skip</Button.Root>
	<Button.Root variant="danger">Delete</Button.Root>
	<Button.Root disabled>Disabled</Button.Root>
</div>
