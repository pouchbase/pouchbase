<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import * as Icon from '../icon';

	let {
		ref = $bindable(null),
		class: className,
		children: content,
		...rest
	}: DropdownMenu.RadioItemProps = $props();
</script>

<!-- An item of a `RadioGroup`; the checked one shows a check mark at the end. -->
<DropdownMenu.RadioItem
	bind:ref
	{...rest}
	class={[
		'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm text-zinc-700 outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-zinc-100 data-highlighted:text-zinc-900 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-zinc-500',
		className
	]}
>
	{#snippet children({ checked })}
		{@render content?.({ checked })}

		{#if checked}
			<Icon.Root icon="lucide:check" class="ml-auto text-zinc-900!" />
		{/if}
	{/snippet}
</DropdownMenu.RadioItem>
