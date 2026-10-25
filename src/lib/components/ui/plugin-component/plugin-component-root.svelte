<script module lang="ts">
	import type { Snippet } from 'svelte';
	import type { PluginRef } from '#lib/plugins/module-loader.js';

	export type Props = {
		/** The plugin the component belongs to; an `InstalledPlugin` fits. */
		plugin: PluginRef & { name?: string };
		/** Bundle path of the component, e.g. `ui/pages/overview.svelte`. */
		path: string;
		/** Props passed to the component (`FieldInputProps`, `FieldPreviewProps`, `PageProps`). */
		props?: Record<string, unknown>;
		/** Shown while the component loads, and always during SSR; a skeleton by default. */
		loading?: Snippet;
		/** Shown when the component can't load or throws; an error callout by default. */
		fallback?: Snippet<[error: unknown, reset: () => void]>;
		/** Classes of the default skeleton and callout. */
		class?: string;
	};
</script>

<script lang="ts">
	import type { PluginComponent } from '#lib/plugins/module-loader.js';
	import * as Callout from '../callout/index.js';
	import * as Icon from '../icon/index.js';
	import * as Skeleton from '../skeleton/index.js';
	import { errorMessage } from '#lib/errors.js';
	import { loadPluginComponent } from '#lib/plugins/module-loader.js';

	let { plugin, path, props = {}, loading, fallback, class: className }: Props = $props();

	let Component = $state<PluginComponent | null>(null);
	let loadError = $state<{ error: unknown } | null>(null);
	// Bumped by `reset` to load again after a failure.
	let attempt = $state(0);

	// Only these change what is loaded: callers pass a new `plugin` object on every render (the
	// records grid does), and loading again for each of them would churn.
	const id = $derived(plugin.id);
	const version = $derived(plugin.version);
	const embedded = $derived(plugin.embedded);

	// Plugin components only run in the browser: effects don't run during SSR, so the server
	// renders the loading state and never loads them.
	$effect(() => {
		const ref = { id, version, embedded };
		let current = true;

		void attempt;
		Component = null;
		loadError = null;

		loadPluginComponent(ref, path).then(
			(loaded) => {
				if (current) {
					Component = loaded;
				}
			},
			(error: unknown) => {
				if (current) {
					report(error);
					loadError = { error };
				}
			}
		);

		return () => {
			current = false;
		};
	});

	function report(error: unknown) {
		console.error(`[plugins] ${plugin.name ?? plugin.id} failed (${path}):`, error);
	}

	function retry() {
		attempt += 1;
	}
</script>

<!--
	A plugin's component, isolated: a skeleton while it loads, and when it fails only it does,
	whether it fails to load or throws while rendering.
-->
{#if loadError}
	{@render failure(loadError.error, retry)}
{:else if Component}
	<svelte:boundary onerror={report}>
		<Component {...props} />

		{#snippet failed(error, reset)}
			{@render failure(error, reset)}
		{/snippet}
	</svelte:boundary>
{:else if loading}
	{@render loading()}
{:else}
	<div class={['flex flex-col gap-2', className]} aria-busy="true">
		<span class="sr-only" role="status">Loading…</span>
		<Skeleton.Root class="h-4 w-2/3" />
		<Skeleton.Root class="h-control w-full" />
	</div>
{/if}

{#snippet failure(error: unknown, reset: () => void)}
	{#if fallback}
		{@render fallback(error, reset)}
	{:else}
		<Callout.Root variant="error" class={className}>
			<Icon.Root icon="lucide:circle-alert" class="size-4 shrink-0" />
			<p class="min-w-0 break-words">{plugin.name ?? plugin.id} failed: {errorMessage(error)}</p>
		</Callout.Root>
	{/if}
{/snippet}
