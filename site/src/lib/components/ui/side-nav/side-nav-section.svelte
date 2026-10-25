<script module lang="ts">
	import { Collapsible } from 'bits-ui';

	export type Props = Omit<Collapsible.RootProps, 'child'> & {
		/** The text of the button that opens and closes the section. */
		label: string;
	};
</script>

<script lang="ts">
	import * as Icon from '../icon/index.js';

	let { open = $bindable(false), label, children, class: className, ...rest }: Props = $props();
</script>

<!-- A collapsible list of links inside a side nav group, which can hold further sections. -->
<Collapsible.Root bind:open {...rest} class={['flex flex-col gap-0.5', className]}>
	<Collapsible.Trigger
		class="group flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-zinc-600 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
	>
		<span class="flex-1">{label}</span>
		<Icon.Root
			icon="lucide:chevron-right"
			class="size-4 shrink-0 text-zinc-400 transition-transform group-data-[state=open]:rotate-90"
		/>
	</Collapsible.Trigger>

	<Collapsible.Content class="ml-3 flex flex-col gap-0.5 border-l border-zinc-200 pl-2">
		{@render children?.()}
	</Collapsible.Content>
</Collapsible.Root>
