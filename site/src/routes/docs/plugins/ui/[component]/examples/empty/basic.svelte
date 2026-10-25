<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Empty from '@pouchbasejs/ui/empty';
	import * as Icon from '@pouchbasejs/ui/icon';
</script>

<Empty.Root>
	<Empty.Icon><Icon.Root icon="lucide:database" /></Empty.Icon>
	<Empty.Title>No records yet</Empty.Title>
	<Empty.Description>Records you add to this collection show up here.</Empty.Description>
	<Button.Root>
		<Icon.Root icon="lucide:plus" />
		New record
	</Button.Root>
</Empty.Root>
