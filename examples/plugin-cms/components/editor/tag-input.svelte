<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';

	import { icons } from '../../lib/icons.js';
	import { MAX_TAGS } from '../../lib/posts.js';

	type Props = {
		tags: string[];
		id?: string;
	};

	let { tags = $bindable(), id }: Props = $props();

	let draft = $state('');

	function add() {
		const names = draft
			.split(',')
			.map((name) => name.trim())
			.filter(Boolean);

		draft = '';

		for (const name of names) {
			const exists = tags.some((tag) => tag.toLowerCase() === name.toLowerCase());

			if (!exists && tags.length < MAX_TAGS) {
				tags.push(name);
			}
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			add();
		} else if (event.key === 'Backspace' && draft === '' && tags.length) {
			tags.pop();
		}
	}
</script>

<!-- Tags as tokens: Enter or a comma adds one, Backspace in the empty field removes the last. -->
<div
	class="flex min-h-control flex-wrap items-center gap-1 rounded-md border border-zinc-300 bg-white px-1.5 py-1 shadow-xs focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10"
>
	{#each tags as tag, i (tag)}
		<span
			class="inline-flex h-6 items-center gap-1 rounded-sm bg-zinc-100 pr-0.5 pl-2 text-xs text-zinc-800"
		>
			{tag}
			<button
				type="button"
				aria-label="Remove {tag}"
				class="rounded-sm p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
				onclick={() => tags.splice(i, 1)}
			>
				<Icon.Root src={icons.x} class="size-3" />
			</button>
		</span>
	{/each}
	<input
		{id}
		type="text"
		bind:value={draft}
		onkeydown={handleKeydown}
		onblur={add}
		disabled={tags.length >= MAX_TAGS}
		placeholder={tags.length ? '' : 'Add a tag'}
		class="h-6 min-w-20 flex-1 border-none bg-transparent px-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-0"
	/>
</div>
<p class="text-xs text-zinc-500">Separate with commas or the Enter key.</p>
