<script lang="ts">
	import type { PluginPermissions } from '@pouchbasejs/plugin-sdk';
	import { pluginCollectionName } from '@pouchbasejs/plugin-sdk';
	import * as Icon from '#lib/components/ui/icon/index.js';

	type Props = {
		pluginId: string;
		permissions: PluginPermissions | undefined;
		/** The plugin's own collections, without the prefix. */
		collections?: readonly string[];
	};

	let { pluginId, permissions, collections = [] }: Props = $props();

	const hosts = $derived(permissions?.network ?? []);
	const write = $derived(permissions?.collections?.write ?? []);
	// `write` includes reading, so those aren't listed twice.
	const read = $derived(
		(permissions?.collections?.read ?? []).filter((name) => !write.includes(name))
	);
	const own = $derived(collections.map((name) => pluginCollectionName(pluginId, name)));
	const usesData = $derived(read.length + write.length + own.length > 0);

	function label(name: string) {
		return name === '*' ? 'Every collection' : name;
	}
</script>

{#snippet list(items: readonly string[], icon: 'globe' | 'eye' | 'pencil' | 'database')}
	<ul class="flex flex-col gap-1">
		{#each items as item (item)}
			<li class="flex items-center gap-2 font-mono text-sm text-zinc-900">
				{#if icon === 'globe'}
					<Icon.Root icon="lucide:globe" class="size-4 text-zinc-500" />
				{:else if icon === 'eye'}
					<Icon.Root icon="lucide:eye" class="size-4 text-zinc-500" />
				{:else if icon === 'pencil'}
					<Icon.Root icon="lucide:pencil" class="size-4 text-zinc-500" />
				{:else}
					<Icon.Root icon="lucide:database" class="size-4 text-zinc-500" />
				{/if}
				{label(item)}
			</li>
		{/each}
	</ul>
{/snippet}

<div class="flex flex-col gap-2">
	<h3 class="text-sm font-medium text-zinc-900">Permissions</h3>

	{#if hosts.length}
		<p class="text-sm text-zinc-600">The plugin's server code can connect to:</p>
		{@render list(hosts, 'globe')}
	{/if}

	{#if own.length}
		<p class="text-sm text-zinc-600">
			It creates these collections, which are deleted with their records when it's removed:
		</p>
		{@render list(own, 'database')}
	{/if}

	{#if write.length}
		<p class="text-sm text-zinc-600">It can read, create, change and delete records of:</p>
		{@render list(write, 'pencil')}
	{/if}

	{#if read.length}
		<p class="text-sm text-zinc-600">It can read the records of:</p>
		{@render list(read, 'eye')}
	{/if}

	{#if usesData}
		<p class="text-sm text-zinc-600">
			The collections' API rules don't apply to the plugin. It can't reach other collections, the
			storage or Pouchbase's settings.
		</p>
	{:else if !hosts.length}
		<p class="text-sm text-zinc-600">
			No network or data access. The plugin runs in a sandbox and only sees the data Pouchbase
			passes to it.
		</p>
	{/if}
</div>
