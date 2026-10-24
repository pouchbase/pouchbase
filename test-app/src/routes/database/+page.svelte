<script lang="ts">
	import type { AnyInclude, OrderBy, Where } from '@pouchbasejs/js-sdk';
	import Output from '#lib/components/output.svelte';
	import Panel from '#lib/components/panel.svelte';
	import { pouch } from '#lib/pouchbase.svelte.js';
	import { parseJson, rawCondition, Runner } from '#lib/run.svelte.js';

	type AnyRecord = Record<string, unknown>;

	const runner = new Runner();

	let collection = $state('posts');
	let whereMode = $state<'where' | 'condition'>('where');
	let where = $state('');
	let orderBy = $state('{ "created_at": "desc" }');
	let select = $state('');
	let include = $state('');
	let limit = $state(20);
	let offset = $state(0);
	let id = $state('');
	let body = $state('{\n\t"title": "Hello"\n}');

	const records = $derived(pouch.db.$collection(collection.trim()));

	function query() {
		const fields = select
			.split(',')
			.map((field) => field.trim())
			.filter(Boolean);

		return {
			where:
				whereMode === 'condition'
					? where.trim()
						? rawCondition(where)
						: undefined
					: (parseJson(where) as Where<AnyRecord> | undefined),
			orderBy: parseJson(orderBy) as OrderBy<AnyRecord> | undefined,
			select: fields.length > 0 ? fields : undefined,
			include: included()
		};
	}

	/** Relations to return as records, e.g. `{ "author": true }`; used by every call but count. */
	function included() {
		return parseJson(include) as AnyInclude | undefined;
	}
</script>

<Panel title="Collection" description="pouch.db.$collection(name); typed apps use pouch.db.<name>">
	<div class="stack">
		<div class="row">
			<label>Name <input bind:value={collection} /></label>
		</div>
		<label>
			include (JSON, every call but count)
			<input
				bind:value={include}
				placeholder={'{ "author": true, "comments": { "include": { "author": true } } }'}
			/>
		</label>
	</div>
</Panel>

<div class="grid">
	<Panel title="List" description="GET /api/db/<collection>">
		<div class="stack">
			<div class="row">
				<label>
					Conditions
					<select bind:value={whereMode}>
						<option value="where">where (JSON)</option>
						<option value="condition">condition (expression)</option>
					</select>
				</label>
			</div>
			<textarea
				bind:value={where}
				rows="3"
				placeholder={whereMode === 'where'
					? '{ "status": "published", "views": { "gte": 10 } }'
					: 'author == $user.id'}></textarea>
			<label>orderBy (JSON) <input bind:value={orderBy} /></label>
			<label>select (comma separated) <input bind:value={select} placeholder="id, title" /></label>
			<div class="row">
				<label>limit <input bind:value={limit} type="number" min="1" /></label>
				<label>offset <input bind:value={offset} type="number" min="0" /></label>
			</div>
			<div class="row">
				<button
					disabled={runner.loading}
					onclick={() => runner.run(() => records.findMany({ ...query(), limit, offset }))}
				>
					findMany
				</button>
				<button
					class="ghost"
					disabled={runner.loading}
					onclick={() => runner.run(() => records.findFirst(query()))}
				>
					findFirst
				</button>
				<button
					class="ghost"
					disabled={runner.loading}
					onclick={() => runner.run(() => records.count(query().where))}
				>
					count
				</button>
				<button
					class="ghost"
					disabled={runner.loading}
					onclick={() => runner.run(() => records.findAll(query()))}
				>
					findAll
				</button>
			</div>
		</div>
	</Panel>

	<Panel title="One record" description="find, insert, patch and remove">
		<div class="stack">
			<label>Id <input bind:value={id} /></label>
			<label>Body (JSON) <textarea bind:value={body} rows="6"></textarea></label>
			<div class="row">
				<button
					disabled={runner.loading}
					onclick={() => runner.run(() => records.find(id, { include: included() }))}
				>
					find
				</button>
				<button
					disabled={runner.loading}
					onclick={() =>
						runner.run(async () => {
							const created = await records.insert(parseJson(body) as AnyRecord, {
								include: included()
							});

							id = String(created.id);

							return created;
						})}
				>
					insert
				</button>
				<button
					disabled={runner.loading}
					onclick={() =>
						runner.run(() =>
							records.patch(id, parseJson(body) as AnyRecord, { include: included() })
						)}
				>
					patch
				</button>
				<button
					class="ghost"
					disabled={runner.loading}
					onclick={() => runner.run(() => records.remove(id))}
				>
					remove
				</button>
				<button
					class="ghost"
					disabled={runner.loading}
					onclick={() => runner.run(() => records.insert(parseJson(body) as AnyRecord).safe())}
				>
					insert().safe()
				</button>
			</div>
		</div>
	</Panel>
</div>

<Output outcome={runner.outcome} />
