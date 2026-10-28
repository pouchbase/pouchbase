<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as DropdownMenu from '../dropdown-menu/index.js';
	import * as Icon from '../icon/index.js';

	type Props = {
		/** Accessible name of the ellipsis button, e.g. `Backup actions`. */
		label: string;
		disabled?: boolean;
		/** The `RowActions.Item`s and `RowActions.Separator`s of the menu. */
		children: Snippet;
	};

	let { label, disabled = false, children }: Props = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger variant="ghost" size="icon" aria-label={label} {disabled}>
		<Icon.Root icon="lucide:ellipsis" />
	</DropdownMenu.Trigger>

	<DropdownMenu.Content>
		{@render children()}
	</DropdownMenu.Content>
</DropdownMenu.Root>
