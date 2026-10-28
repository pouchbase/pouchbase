<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import * as DropdownMenu from '../dropdown-menu/index.js';

	let props: ComponentProps<typeof DropdownMenu.Separator> = $props();
</script>

<DropdownMenu.Separator {...props} />
