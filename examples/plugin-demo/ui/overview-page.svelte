<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Badge from '@pouchbasejs/ui/badge';
	import * as Button from '@pouchbasejs/ui/button';
	import * as Callout from '@pouchbasejs/ui/callout';
	import * as Card from '@pouchbasejs/ui/card';
	import * as Input from '@pouchbasejs/ui/inputs/input';

	let { params, api }: PageProps = $props();

	type Info = { id: string; version: string; greeting: string };
	type Status = { indicator: string; description: string };

	/** Calls a route of the plugin and throws its error message on a non-2xx answer. */
	async function call<T>(path: `/${string}`, init?: RequestInit): Promise<T> {
		const response = await api.fetch(path, init);
		const body = await response.json().catch(() => null);

		if (!response.ok) {
			throw new Error(body?.error ?? `The route answered ${response.status}`);
		}

		return body as T;
	}

	let info = $state(call<Info>('/info'));
	let status = $state<Promise<Status>>();
	let message = $state('');
	let echo = $state<{ message: string; length: number } | { error: string }>();

	async function send() {
		try {
			echo = await call('/echo', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message })
			});
		} catch (error) {
			echo = { error: (error as Error).message };
		}
	}
</script>

<div style:display="grid" style:gap="1rem" style:max-width="40rem">
	<Card.Root>
		<Card.Header>
			<Card.Title>Plugin</Card.Title>
			<Card.Description>What <code>GET /info</code> returns.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#await info}
				<p>Loading…</p>
			{:then { id, version, greeting }}
				<p>{greeting} from <strong>{id}</strong> <Badge.Root>{version}</Badge.Root></p>
			{:catch error}
				<Callout.Root variant="error">{error.message}</Callout.Root>
			{/await}

			<!-- Everything below the page's path, e.g. /plugins/demo/overview/a/b → a/b. -->
			<p>Path below the page: /{params.join('/')}</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Echo</Card.Title>
			<Card.Description>Sends JSON to <code>POST /echo</code>.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div style:display="flex" style:gap="0.5rem">
				<Input.Root bind:value={message} placeholder="A message" aria-label="Message" />
				<Button.Root onclick={send}>Send</Button.Root>
			</div>

			{#if echo && 'error' in echo}
				<Callout.Root variant="error">{echo.error}</Callout.Root>
			{:else if echo}
				<Callout.Root variant="success">{echo.length} characters: “{echo.message}”</Callout.Root>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>GitHub status</Card.Title>
			<Card.Description>
				<code>GET /github-status</code> calls an outside API, allowed by
				<code>permissions.network</code>.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if status}
				{#await status}
					<p>Loading…</p>
				{:then { indicator, description }}
					<p>
						<Badge.Root variant={indicator === 'none' ? 'success' : 'warning'}>
							{indicator}
						</Badge.Root>
						{description}
					</p>
				{:catch error}
					<Callout.Root variant="error">{error.message}</Callout.Root>
				{/await}
			{/if}

			<!-- An onclick that returns a promise shows the spinner until it settles. -->
			<Button.Root
				variant="secondary"
				onclick={() => {
					status = call<Status>('/github-status');

					return status.catch(() => {});
				}}
			>
				Check
			</Button.Root>
		</Card.Content>
	</Card.Root>
</div>
