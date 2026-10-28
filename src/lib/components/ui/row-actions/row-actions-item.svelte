<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import * as DropdownMenu from '../dropdown-menu/index.js';
	import * as Icon from '../icon/index.js';

	type Props = ComponentProps<typeof DropdownMenu.Item> & {
		/** Iconify name shown before the label, e.g. `lucide:trash-2`. */
		icon?: string;
	};

	let { icon, children, ...rest }: Props = $props();
</script>

<DropdownMenu.Item {...rest}>
	{#if icon}
		<Icon.Root {icon} />
	{/if}

	{@render children?.()}
</DropdownMenu.Item>
