<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';

	import { icons, type IconName } from '../../lib/icons.js';

	type Props = {
		icon: IconName;
		label: string;
		/** A toggle that is on, e.g. Bold in bold text or the current heading level. */
		pressed?: boolean;
		disabled?: boolean;
		ref?: HTMLElement | null;
		onclick: () => void;
	};

	let { icon, label, pressed, disabled, ref = $bindable(null), onclick }: Props = $props();
</script>

<!-- `mousedown` doesn't take the focus, so the block keeps its caret and selection. -->
<Button.Root
	bind:ref
	variant="ghost"
	size="icon"
	aria-label={label}
	title={label}
	aria-pressed={pressed}
	{disabled}
	onmousedown={(event: MouseEvent) => event.preventDefault()}
	{onclick}
	class={['rounded-none', pressed && 'bg-zinc-900! text-white!']}
>
	<Icon.Root src={icons[icon]} />
</Button.Root>
