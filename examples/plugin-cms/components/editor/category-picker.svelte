<script lang="ts">
	import type { PluginApi } from '@pouchbasejs/plugin-sdk/ui';

	import * as Button from '@pouchbasejs/ui/button';
	import * as Checkbox from '@pouchbasejs/ui/inputs/checkbox';
	import * as Input from '@pouchbasejs/ui/inputs/input';

	import { ApiError, request } from '../../lib/api.js';
	import type { Category } from '../../lib/posts.js';

	type Props = {
		api: PluginApi;
		/** Every category, by name; a new one is added to it. */
		categories: Category[];
		/** The ids of the post's categories. */
		selected: string[];
	};

	let { api, categories = $bindable(), selected = $bindable() }: Props = $props();

	const id = $props.id();

	let adding = $state(false);
	let name = $state('');
	let error = $state('');

	function toggle(category: Category, checked: boolean) {
		selected = checked
			? [...selected, category.id]
			: selected.filter((item) => item !== category.id);
	}

	async function add(event: SubmitEvent) {
		event.preventDefault();
		error = '';

		try {
			const category = await request<Category>(api, '/categories', {
				method: 'POST',
				body: { name }
			});

			if (!categories.some((item) => item.id === category.id)) {
				categories = [...categories, category].sort((a, b) => a.name.localeCompare(b.name));
			}

			if (!selected.includes(category.id)) {
				selected = [...selected, category.id];
			}

			name = '';
			adding = false;
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Could not add the category';
		}
	}
</script>

{#if categories.length}
	<ul class="flex max-h-48 flex-col gap-2 overflow-y-auto">
		{#each categories as category (category.id)}
			<li class="flex items-center gap-2">
				<Checkbox.Root
					id="{id}-{category.id}"
					checked={selected.includes(category.id)}
					onchange={(event) => toggle(category, event.currentTarget.checked)}
				/>
				<label for="{id}-{category.id}" class="text-sm text-zinc-800">{category.name}</label>
			</li>
		{/each}
	</ul>
{:else}
	<p class="text-sm text-zinc-500">No categories yet.</p>
{/if}

{#if adding}
	<form class="flex flex-col gap-2" onsubmit={add}>
		<label for="{id}-name" class="text-xs font-medium tracking-wide text-zinc-600 uppercase">
			New category name
		</label>
		<Input.Root
			id="{id}-name"
			bind:value={name}
			aria-invalid={!!error || undefined}
			{@attach (input) => input.focus()}
		/>
		{#if error}
			<p class="text-xs text-red-600">{error}</p>
		{/if}
		<div class="flex gap-2">
			<Button.Root type="submit" variant="secondary" disabled={!name.trim()}>
				Add category
			</Button.Root>
			<Button.Root variant="ghost" onclick={() => (adding = false)}>Cancel</Button.Root>
		</div>
	</form>
{:else}
	<button
		type="button"
		class="self-start text-sm text-blue-700 underline-offset-2 hover:underline"
		onclick={() => (adding = true)}
	>
		Add new category
	</button>
{/if}
