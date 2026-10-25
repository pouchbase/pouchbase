<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Callout from '@pouchbasejs/ui/callout';
	import * as Icon from '@pouchbasejs/ui/icon';
</script>

<Callout.Root variant="warning">
	<Callout.Icon><Icon.Root icon="lucide:key-round" /></Callout.Icon>
	<Callout.Body>
		<Callout.Title>The API key expires in 3 days</Callout.Title>
		<Callout.Description>Requests with it fail once it has expired.</Callout.Description>
		<div class="mt-2">
			<Button.Root variant="secondary">Renew key</Button.Root>
		</div>
	</Callout.Body>
</Callout.Root>
