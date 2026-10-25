<script lang="ts">
	import { untrack } from 'svelte';
	import type { PluginSummary } from '@pouchbasejs/plugin-sdk';
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Link from '#lib/components/ui/link/index.js';
	import * as Skeleton from '#lib/components/ui/skeleton/index.js';
	import { errorMessage } from '#lib/errors.js';
	import { describeContributions } from './contributions';
	import PluginCategories from './plugin-categories.svelte';
	import PluginPermissions from './plugin-permissions.svelte';
	import { getPluginDetails, installPlugin } from './plugins.remote';

	type Props = {
		plugin: PluginSummary;
		/** Version that is installed now, when this is an update. */
		installedVersion?: string;
	} & DialogProps;

	let { plugin, installedVersion, close }: Props = $props();

	const form = $derived.by(() => {
		const key = plugin.id;

		return untrack(() => installPlugin.for(key));
	});
	const action = $derived(installedVersion ? 'Update' : 'Install');
</script>

<Dialog.Content>
	<Dialog.Header>
		<Dialog.Title>{action} {plugin.name}</Dialog.Title>
		<Dialog.Description>{plugin.description}</Dialog.Description>
		<PluginCategories categories={plugin.categories} class="pt-1" />
	</Dialog.Header>

	<svelte:boundary>
		{@const details = await getPluginDetails(plugin.id)}
		{@const latest =
			details.versions.find((version) => version.version === details.version) ??
			details.versions[0]}
		{@const adds = describeContributions(latest?.contributes)}

		<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
			<dt class="text-zinc-500">Version</dt>
			<dd class="font-mono text-zinc-900">
				{#if installedVersion}
					{installedVersion} → {details.version}
				{:else}
					{details.version}
				{/if}
			</dd>

			{#if details.author}
				<dt class="text-zinc-500">Author</dt>
				<dd class="text-zinc-900">{details.author}</dd>
			{/if}

			<dt class="text-zinc-500">License</dt>
			<dd class="text-zinc-900">{details.license}</dd>

			<!-- Registries before the contributions summary don't say; then this stays out. -->
			{#if adds}
				<dt class="text-zinc-500">Adds</dt>
				<dd class="text-zinc-900">{adds}</dd>
			{/if}

			{#if details.homepage ?? details.repository}
				<dt class="text-zinc-500">Website</dt>
				<dd class="truncate">
					<Link.Root
						href={(details.homepage ?? details.repository)!}
						target="_blank"
						rel="noreferrer"
					>
						{details.homepage ?? details.repository}
					</Link.Root>
				</dd>
			{/if}
		</dl>

		<PluginPermissions
			pluginId={plugin.id}
			permissions={latest?.permissions}
			collections={latest?.contributes?.collections}
		/>

		{#if !details.verified}
			<Callout.Root variant="warning">
				<Icon.Root icon="lucide:triangle-alert" class="size-4 shrink-0" />
				<p>
					This plugin has not been reviewed by the Pouchbase team. Only install plugins from authors
					you trust.
				</p>
			</Callout.Root>
		{/if}

		{#snippet pending()}
			<div class="flex flex-col gap-2">
				<Skeleton.Root class="h-4 w-1/2" />
				<Skeleton.Root class="h-4 w-2/3" />
				<Skeleton.Root class="h-4 w-1/3" />
			</div>
		{/snippet}

		{#snippet failed(error)}
			<Callout.Root variant="error">
				<Icon.Root icon="lucide:circle-alert" class="size-4 shrink-0" />
				<p>{errorMessage(error)}</p>
			</Callout.Root>
		{/snippet}
	</svelte:boundary>

	<Form.Root
		{form}
		success={`${plugin.name} ${installedVersion ? 'updated' : 'installed'}`}
		enhance={async (instance) => {
			if (await instance.submit()) {
				close();
			}
		}}
	>
		<Form.Hidden field={form.fields.id} value={plugin.id} />

		<Dialog.Footer>
			<Dialog.Close>Cancel</Dialog.Close>
			<Form.Submit>{action}</Form.Submit>
		</Dialog.Footer>
	</Form.Root>
</Dialog.Content>
