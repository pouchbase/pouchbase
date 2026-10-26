<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';

	import type { BLOCK_TYPES, BlockType } from '../../lib/blocks.js';
	import { icons } from '../../lib/icons.js';

	type Props = {
		/** The matching block types, from `findBlockTypes`. */
		types: typeof BLOCK_TYPES;
		/** The highlighted one, moved with the arrow keys by the block. */
		active: number;
		onpick: (type: BlockType) => void;
	};

	let { types, active, onpick }: Props = $props();
</script>

<!-- Lists the block types while a paragraph starts with `/`; the block handles the keys. -->
<div
	role="listbox"
	aria-label="Blocks"
	tabindex="-1"
	onmousedown={(event) => event.preventDefault()}
	class="absolute top-full left-0 z-40 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg"
>
	{#each types as type, i (type.type)}
		<button
			type="button"
			role="option"
			aria-selected={i === active}
			class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left aria-selected:bg-blue-50 aria-selected:text-blue-800"
			onclick={() => onpick(type.type)}
		>
			<Icon.Root src={icons[type.icon]} class="size-5 text-zinc-600" />
			<span class="text-sm font-medium">{type.label}</span>
		</button>
	{:else}
		<p class="px-2 py-1.5 text-sm text-zinc-500">No blocks found.</p>
	{/each}
</div>
