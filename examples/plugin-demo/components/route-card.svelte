<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { RouteInfo } from '../lib/catalog.js';

	import * as Badge from '@pouchbasejs/ui/badge';
	import * as Button from '@pouchbasejs/ui/button';
	import * as Card from '@pouchbasejs/ui/card';
	import * as Icon from '@pouchbasejs/ui/icon';

	import CopyButton from './copy-button.svelte';
	import JsonView from './json-view.svelte';
	import MethodBadge from './method-badge.svelte';

	type Props = {
		route: RouteInfo;
		/** Sends the request, e.g. with `api.fetch`. */
		send: () => Promise<Response>;
		/** The same request as a curl command. */
		curl: string;
		/** What the request sends: inputs for its body or parameters, or a note. */
		children?: Snippet;
	};

	let { route, send, curl, children }: Props = $props();

	type Result = { status: number; ms: number; body: unknown };

	let result = $state<Result | null>(null);

	const STATUS_TEXT: Record<number, string> = {
		200: 'OK',
		401: 'Unauthorized',
		404: 'Not found',
		422: 'Unprocessable',
		502: 'Bad gateway'
	};

	// The button shows its spinner while this runs, because it returns a promise.
	async function run() {
		const start = performance.now();

		try {
			const response = await send();
			const text = await response.text();
			let body: unknown = text;

			try {
				body = JSON.parse(text);
			} catch {
				// Not JSON: shown as text.
			}

			result = { status: response.status, ms: Math.round(performance.now() - start), body };
		} catch (error) {
			result = {
				status: 0,
				ms: Math.round(performance.now() - start),
				body: { error: (error as Error).message }
			};
		}
	}

	const variant = $derived(
		!result || result.status === 0 || result.status >= 500
			? 'danger'
			: result.status >= 400
				? 'warning'
				: 'success'
	);
</script>

<Card.Root class="overflow-hidden">
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
		<MethodBadge method={route.method} />
		<code class="font-mono text-sm font-medium text-zinc-900">{route.path}</code>
		<p class="min-w-0 flex-1 basis-56 text-sm text-zinc-500">{route.description}</p>

		<Button.Root variant="secondary" onclick={run}>
			<Icon.Root icon="lucide:send" />
			Send
		</Button.Root>
	</div>

	{#if children}
		<div class="border-t border-zinc-100 px-4 py-3">
			{@render children()}
		</div>
	{/if}

	{#if result}
		<div class="flex flex-col gap-2 border-t border-zinc-100 bg-zinc-50 p-4">
			<div class="flex flex-wrap items-center gap-2 text-xs">
				<Badge.Root {variant}>
					{result.status === 0 ? 'Failed' : `${result.status} ${STATUS_TEXT[result.status] ?? ''}`}
				</Badge.Root>
				<span class="text-zinc-500 tabular-nums">{result.ms} ms</span>
				<span class="ml-auto font-mono text-zinc-400">routes/{route.file}</span>
			</div>

			<JsonView value={result.body} />
		</div>
	{/if}

	<div class="flex items-center gap-2 border-t border-zinc-100 bg-white py-1.5 pr-2 pl-4">
		<code class="min-w-0 flex-1 truncate font-mono text-xs text-zinc-500" title={curl}>{curl}</code>
		<CopyButton text={curl} label="Copy as curl" />
	</div>
</Card.Root>
