<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Input from '@pouchbasejs/ui/inputs/input';

	import { icons } from '../../lib/icons.js';

	type Props = {
		url: string | null;
	};

	let { url = $bindable() }: Props = $props();

	const id = $props.id();

	let editing = $state(false);
	let draft = $state('');

	function edit() {
		draft = url ?? '';
		editing = true;
	}

	function set(event: SubmitEvent) {
		event.preventDefault();
		url = draft.trim() || null;
		editing = false;
	}
</script>

{#if editing}
	<form class="flex flex-col gap-2" onsubmit={set}>
		<label for={id} class="text-xs font-medium tracking-wide text-zinc-600 uppercase">
			Image URL
		</label>
		<Input.Root
			{id}
			type="url"
			bind:value={draft}
			placeholder="https://example.com/cover.jpg"
			{@attach (input) => input.focus()}
		/>
		<div class="flex gap-2">
			<Button.Root type="submit" variant="secondary">Set image</Button.Root>
			<Button.Root variant="ghost" onclick={() => (editing = false)}>Cancel</Button.Root>
		</div>
	</form>
{:else if url}
	<div class="flex flex-col gap-2">
		<button
			type="button"
			class="overflow-hidden rounded-md border border-zinc-200"
			aria-label="Replace the featured image"
			onclick={edit}
		>
			<img src={url} alt="" class="aspect-video w-full object-cover" />
		</button>
		<div class="flex gap-2">
			<Button.Root variant="secondary" class="flex-1" onclick={edit}>Replace</Button.Root>
			<Button.Root variant="ghost" class="flex-1 text-red-700" onclick={() => (url = null)}>
				Remove
			</Button.Root>
		</div>
	</div>
{:else}
	<button
		type="button"
		onclick={edit}
		class="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md bg-zinc-100 text-sm text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
	>
		<Icon.Root src={icons.image} class="size-6" />
		Set featured image
	</button>
{/if}
