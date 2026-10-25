<script module lang="ts">
	import type { PageMeta } from '@pouchbasejs/plugin-sdk/ui';

	export const page = {
		title: 'Field playground',
		navigation: true,
		order: 2,
		icon: 'lucide:shapes'
	} satisfies PageMeta;
</script>

<script lang="ts">
	import * as Callout from '@pouchbasejs/ui/callout';
	import * as Icon from '@pouchbasejs/ui/icon';

	import FieldPlayground from '../components/field-playground.svelte';
	import PageHeader from '../components/page-header.svelte';
	import { FIELD_TYPE_LIST } from '../lib/catalog.js';
</script>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Field playground"
		description="The plugin's field types, as Pouchbase shows them: the input in the record form, the preview in the records grid. Change a value to see what the form submits and what Pouchbase stores."
	/>

	<Callout.Root>
		<Callout.Icon><Icon.Root icon="lucide:info" /></Callout.Icon>
		<Callout.Body>
			<Callout.Description>
				Pouchbase checks every value on the server, with the field type's
				<code class="font-mono text-xs">validate</code>, before it stores what
				<code class="font-mono text-xs">serialize</code> returns. This page uses the same checks
				from
				<code class="font-mono text-xs">lib/</code>, so what you see here is what a record gets.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	{#each FIELD_TYPE_LIST as type (type.type)}
		<FieldPlayground type={type.type} />
	{/each}
</div>
