<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Input from '@pouchbasejs/ui/inputs/input';

	import { findBlockTypes, type BlockType } from '../../lib/blocks.js';
	import { icons } from '../../lib/icons.js';

	type Props = {
		onpick: (type: BlockType) => void;
	};

	let { onpick }: Props = $props();

	let query = $state('');

	const types = $derived(findBlockTypes(query));

	function submit(event: SubmitEvent) {
		event.preventDefault();

		if (types[0]) {
			onpick(types[0].type);
		}
	}
</script>

<!-- The block library of the "+" buttons: a search and a grid of every block type. -->
<div class="flex w-80 flex-col gap-3 p-1.5">
	<form onsubmit={submit}>
		<Input.Root
			type="search"
			bind:value={query}
			placeholder="Search"
			aria-label="Search blocks"
			class="w-full bg-zinc-100"
			{@attach (input) => input.focus()}
		/>
	</form>

	<div>
		<p class="pb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Text & media</p>
		<div class="grid grid-cols-3 gap-1">
			{#each types as type (type.type)}
				<button
					type="button"
					title={type.description}
					class="flex flex-col items-center gap-2 rounded-md px-1 py-3 text-xs text-zinc-700 hover:bg-zinc-100 hover:text-blue-700"
					onclick={() => onpick(type.type)}
				>
					<Icon.Root src={icons[type.icon]} class="size-6" />
					{type.label}
				</button>
			{:else}
				<p class="col-span-3 py-4 text-center text-sm text-zinc-500">No results found.</p>
			{/each}
		</div>
	</div>
</div>
