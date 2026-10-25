<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Card from '@pouchbasejs/ui/card';
</script>

<Card.Root class="max-w-md">
	<Card.Header>
		<Card.Title>Backups</Card.Title>
		<Card.Description>A copy of the database and the files, every night.</Card.Description>
	</Card.Header>
	<Card.Content class="flex items-center justify-between gap-4">
		<p class="text-sm text-zinc-600">Last backup 2 hours ago</p>
		<Button.Root variant="secondary">Back up now</Button.Root>
	</Card.Content>
</Card.Root>
