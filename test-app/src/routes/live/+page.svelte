<script lang="ts">
	import type {
		AnyInclude,
		ConnectionState,
		LiveEvent,
		LiveSubscription,
		Where
	} from '@pouchbasejs/js-sdk';
	import Panel from '#lib/components/panel.svelte';
	import { pouch } from '#lib/pouchbase.svelte.js';
	import { describeError, parseJson } from '#lib/run.svelte.js';

	type Item = { topic: string } & (
		| { type: 'event'; event: LiveEvent }
		| { type: 'info'; text: string }
		| { type: 'error'; error: unknown }
	);

	type Entry = Item & { id: number; time: string };

	type Running = { id: number; topic: string; subscription: LiveSubscription; ready: boolean };

	let topic = $state('posts');
	let where = $state('');
	let select = $state('');
	let include = $state('');
	let running = $state<Running[]>([]);
	let states = $state<Record<string, ConnectionState>>({});
	let log = $state<Entry[]>([]);
	let nextId = 0;

	function add(item: Item) {
		log = [{ ...item, id: nextId++, time: new Date().toLocaleTimeString() }, ...log].slice(0, 200);
	}

	function watch() {
		const name = topic.trim();
		const fields = select
			.split(',')
			.map((field) => field.trim())
			.filter(Boolean);
		const subscription = pouch.live.watch(
			name,
			(event) => add({ type: 'event', topic: name, event }),
			{
				where: parseJson(where) as Where<Record<string, unknown>> | undefined,
				select: fields.length > 0 ? fields : undefined,
				include: parseJson(include) as AnyInclude | undefined,
				onError: (error) => add({ type: 'error', topic: name, error })
			}
		);
		const entry: Running = { id: nextId++, topic: name, subscription, ready: false };

		running = [...running, entry];
		subscription.ready.then(
			() => {
				const item = running.find((item) => item.id === entry.id);

				if (item) {
					item.ready = true;
				}

				add({ type: 'info', topic: name, text: 'Subscribed' });
			},
			(error) => add({ type: 'error', topic: name, error })
		);
	}

	function stop(entry: Running) {
		entry.subscription.stop();
		running = running.filter((item) => item.id !== entry.id);
		add({ type: 'info', topic: entry.topic, text: 'Unsubscribed' });
	}

	$effect(() => {
		const stop = pouch.live.onState((collection, state) => {
			states[collection] = state;
			add({ type: 'info', topic: collection, text: `Connection ${state}` });
		});

		return () => {
			stop();
			pouch.live.disconnect();
		};
	});
</script>

<div class="grid">
	<Panel title="Watch" description="pouch.live.watch(topic, callback, options)">
		<div class="stack">
			<label>Topic (collection or collection/id) <input bind:value={topic} /></label>
			<label>
				where (JSON)
				<input bind:value={where} placeholder={'{ "status": "published" }'} />
			</label>
			<label>select (comma separated) <input bind:value={select} placeholder="id, title" /></label>
			<label>
				include (JSON)
				<input bind:value={include} placeholder={'{ "author": true }'} />
			</label>
			<div class="row">
				<button onclick={watch} disabled={topic.trim() === ''}>Watch</button>
				<button
					class="ghost"
					onclick={() => {
						pouch.live.disconnect();
						running = [];
					}}
				>
					Disconnect all
				</button>
			</div>
		</div>
	</Panel>

	<Panel title="Subscriptions" description="Connection state per collection from onState()">
		{#each Object.entries(states) as [collection, state] (collection)}
			<p class="muted"><code>{collection}</code>: {state}</p>
		{/each}
		{#each running as entry (entry.id)}
			<div class="row">
				<code>{entry.topic}</code>
				<span class="muted">{entry.ready ? 'ready' : 'waiting'}</span>
				<button class="ghost" onclick={() => stop(entry)}>Stop</button>
			</div>
		{:else}
			<p class="muted">No subscriptions.</p>
		{/each}
	</Panel>
</div>

<Panel title="Events" description="Newest first; the last 200 are kept">
	<div class="row">
		<button class="ghost" onclick={() => (log = [])}>Clear</button>
	</div>
	<ol>
		{#each log as entry (entry.id)}
			<li class={entry.type}>
				<span class="muted">{entry.time} · {entry.topic}</span>
				{#if entry.type === 'event'}
					<strong>{entry.event.action}</strong>
					<pre>{JSON.stringify(entry.event.record, null, 2)}</pre>
				{:else if entry.type === 'error'}
					<pre>{JSON.stringify(describeError(entry.error), null, 2)}</pre>
				{:else}
					<span>{entry.text}</span>
				{/if}
			</li>
		{/each}
	</ol>
</Panel>

<style>
	ol {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		border-left: 3px solid var(--border);
		background: var(--subtle);
		border-radius: 0.25rem;
	}

	li.event {
		border-left-color: var(--ok);
	}

	li.error {
		border-left-color: var(--danger);
	}

	pre {
		margin: 0;
		font-size: 0.8125rem;
		overflow: auto;
	}
</style>
