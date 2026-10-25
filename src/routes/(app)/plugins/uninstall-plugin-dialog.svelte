<script lang="ts">
	import { untrack } from 'svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import type { InstalledPlugin } from './types';
	import { getPluginCollections, getPluginFieldUsage, uninstallPlugin } from './plugins.remote';

	type Props = { plugin: InstalledPlugin } & DialogProps;

	let { plugin, close }: Props = $props();

	const form = $derived.by(() => {
		const key = plugin.id;

		return untrack(() => uninstallPlugin.for(key));
	});
</script>

<Dialog.Content>
	<Dialog.Header>
		<Dialog.Title>Remove {plugin.name}</Dialog.Title>
		<Dialog.Description>
			This removes the plugin and its Worker from Pouchbase. You can install it again from the
			marketplace.
			{#if plugin.replacesBuiltIn}
				The built-in version of this plugin takes its place again.
			{/if}
		</Dialog.Description>
	</Dialog.Header>

	<!-- Only plugins with field types can leave fields behind; a failed look-up doesn't block removing. -->
	{#if plugin.contributes.fields.length}
		<svelte:boundary>
			{@const usage = await getPluginFieldUsage(plugin.id)}

			{#if usage.length}
				<Callout.Root variant="warning">
					<Icon.Root icon="lucide:triangle-alert" class="size-4 shrink-0" />
					<p>
						These fields keep their data but become read-only until you reinstall:
						<span class="font-mono">
							{usage.map((item) => `${item.collection}.${item.field}`).join(', ')}
						</span>
					</p>
				</Callout.Root>
			{/if}

			{#snippet pending()}{/snippet}
			{#snippet failed()}{/snippet}
		</svelte:boundary>
	{/if}

	<!-- Also collections a previous version added, which the manifest may no longer list. -->
	<svelte:boundary>
		{@const owned = await getPluginCollections(plugin.id)}

		{#if owned.length}
			<Callout.Root variant="error">
				<Icon.Root icon="lucide:database" class="size-4 shrink-0" />
				<p>
					These collections of the plugin are deleted with all their records, which can't be undone:
					<span class="font-mono">{owned.join(', ')}</span>
				</p>
			</Callout.Root>
		{/if}

		{#snippet pending()}{/snippet}
		{#snippet failed()}{/snippet}
	</svelte:boundary>

	<Form.Root
		{form}
		success={`${plugin.name} removed`}
		enhance={async (instance) => {
			if (await instance.submit()) {
				close();
			}
		}}
	>
		<Form.Hidden field={form.fields.id} value={plugin.id} />

		<Dialog.Footer>
			<Dialog.Close>Cancel</Dialog.Close>
			<Form.Submit variant="danger">Remove plugin</Form.Submit>
		</Dialog.Footer>
	</Form.Root>
</Dialog.Content>
