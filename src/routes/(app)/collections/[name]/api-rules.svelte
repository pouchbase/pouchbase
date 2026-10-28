<script lang="ts">
	import { untrack } from 'svelte';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import type * as Code from '#lib/components/ui/inputs/code/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { USERS_COLLECTION } from '#lib/auth/users.js';
	import { apiActions, type ApiRuleAction, type ApiRules } from '#lib/filter/rules.js';
	import { apiRulesSchema } from '#lib/schemas/collection-settings.js';
	import ApiRuleCard from './api-rule-card.svelte';
	import ApiRulesHelp from './api-rules-help.svelte';
	import { accessOptions } from './api-rules.js';
	import { updateApiRules } from './collection-settings.remote';
	import type { GridField } from './grid';

	type Props = {
		collection: { id: string; name: string; system: boolean };
		fields: GridField[];
		/** Name of the collection each relation field points to, keyed by field name. */
		relationTargets: Record<string, string>;
		/** The saved rules. */
		rules: ApiRules | undefined;
		/** Fields of `users`, for `$user.*`. */
		userFields: Code.FilterName[];
		/** Fields of every collection, for paths through relations (`author.role`). */
		collections: Record<string, Code.FilterName[]>;
	};

	let { collection, fields, relationTargets, rules, userFields, collections }: Props = $props();

	const form = $derived.by(() => {
		const key = `rules-${collection.id}`;

		return untrack(() => updateApiRules.for(key).preflight(apiRulesSchema));
	});
	const actions = $derived(apiActions(collection));
	const isUsers = $derived(collection.system && collection.name === USERS_COLLECTION);

	const names = $derived<Code.FilterNames>({
		fields: fields
			.filter((field) => field.type !== 'blob')
			.map((field) => ({
				name: field.name,
				type: field.type,
				target: relationTargets[field.name],
				multiple: !!field.options.multiple
			})),
		userFields,
		collections
	});

	// "Owner" choices: relation fields that point to `users`, or the user itself in `users`.
	const owners = $derived(
		isUsers
			? [{ field: 'id', multiple: false }]
			: fields
					.filter(
						(field) => field.type === 'relation' && relationTargets[field.name] === USERS_COLLECTION
					)
					.map((field) => ({ field: field.name, multiple: !!field.options.multiple }))
	);

	const options = $derived(accessOptions(owners, isUsers));

	function initial(): Record<ApiRuleAction, string | null> {
		return {
			list: rules?.list ?? null,
			view: rules?.view ?? null,
			create: rules?.create ?? null,
			update: rules?.update ?? null,
			delete: rules?.delete ?? null
		};
	}

	let current = $state(untrack(initial));
	let saved = $state(untrack(initial));
	let invalid = $state<Partial<Record<ApiRuleAction, boolean>>>({});
	// Bumped to remount the cards, e.g. after discarding changes.
	let generation = $state(0);

	const dirty = $derived(actions.some((action) => current[action] !== saved[action]));
	const hasProblems = $derived(actions.some((action) => invalid[action]));

	function discard() {
		current = { ...saved };
		invalid = {};
		generation++;
	}
</script>

<Form.Root
	{form}
	success="API rules saved"
	class="min-h-0 flex-1 gap-0"
	enhance={async (instance) => {
		if (await instance.submit()) {
			saved = { ...current };
		}
	}}
>
	<Form.Hidden field={form.fields.collection} value={collection.name} />

	{#each actions as action (action)}
		<Form.Hidden field={form.fields[action]} value={current[action] ?? ''} />
		<Form.Hidden field={form.fields[`${action}Locked`]} value={current[action] === null} />
	{/each}

	<Sheet.Body>
		<p class="text-sm text-zinc-600">
			Choose who can use each action of the records API. New collections are private: only admins
			can reach their records until you open them up here.
		</p>

		{#key generation}
			<div class="flex flex-col gap-3">
				{#each actions as action (action)}
					<ApiRuleCard
						{action}
						rule={current[action]}
						{options}
						{names}
						issue={form.fields[action].issues()?.[0]?.message}
						onRuleChange={(rule, valid) => {
							current[action] = rule;
							invalid[action] = !valid;
						}}
					/>
				{/each}
			</div>
		{/key}

		{#if isUsers}
			<p class="text-sm text-zinc-500">
				Users can't be created through the records API: they sign up through
				<span class="font-mono">/api/auth/password/register</span> or OAuth. Their
				<span class="font-mono">email</span> and <span class="font-mono">verified</span> can't be changed
				through it either.
			</p>
		{:else if !actions.includes('create')}
			<p class="text-sm text-zinc-500">
				Files are added by uploading them, so they can only be listed, viewed and deleted through
				the records API.
			</p>
		{/if}

		<ApiRulesHelp />
	</Sheet.Body>

	<Sheet.Footer>
		{#if dirty}
			<p class="mr-auto text-sm text-zinc-500">Unsaved changes</p>
			<Button.Root variant="ghost" onclick={discard}>Discard</Button.Root>
		{/if}

		<Form.Submit disabled={!dirty || hasProblems}>Save rules</Form.Submit>
	</Sheet.Footer>
</Form.Root>
