<script lang="ts">
	import * as Callout from '@pouchbasejs/ui/callout';
	import * as Icon from '@pouchbasejs/ui/icon';
</script>

<div class="flex flex-col gap-3">
	<Callout.Root>
		<Callout.Icon><Icon.Root icon="lucide:info" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Indexes speed up filters</Callout.Title>
			<Callout.Description>Add one for the fields you filter and sort on most.</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<Callout.Root variant="success">
		<Callout.Icon><Icon.Root icon="lucide:circle-check" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Backup complete</Callout.Title>
		</Callout.Body>
	</Callout.Root>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:triangle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Storage is almost full</Callout.Title>
			<Callout.Description>4.6 of 5 GB used.</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<Callout.Root variant="error">
		<Callout.Icon><Icon.Root icon="lucide:circle-x" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>The email could not be sent</Callout.Title>
			<Callout.Description>The mail provider rejected the API key.</Callout.Description>
		</Callout.Body>
	</Callout.Root>
</div>
