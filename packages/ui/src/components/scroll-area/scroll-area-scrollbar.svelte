<script module lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';

	export type Variant = 'default' | 'dark';

	export type Props = ScrollAreaPrimitive.ScrollbarProps & {
		/** `dark` for a dark background, such as a code block. */
		variant?: Variant;
		/** Over the content instead of next to it, so showing it never shifts the layout. */
		overlay?: boolean;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		orientation,
		variant = 'default',
		overlay = false,
		class: className,
		...rest
	}: Props = $props();

	const thumbs = {
		default: 'bg-zinc-300 group-hover:bg-zinc-400 active:bg-zinc-500',
		dark: 'bg-zinc-700 group-hover:bg-zinc-600 active:bg-zinc-500'
	};
</script>

<!-- A slim track that widens while it is hovered or dragged, so the thumb is easy to grab. -->
<ScrollAreaPrimitive.Scrollbar
	bind:ref
	{orientation}
	class={[
		'group flex touch-none p-0.5 transition-[width,height,opacity] duration-150 select-none data-[state=hidden]:opacity-0',
		orientation === 'vertical' ? 'h-full w-2 hover:w-2.5' : 'h-2 flex-col hover:h-2.5',
		overlay &&
			(orientation === 'vertical' ? 'absolute top-0 right-0' : 'absolute bottom-0 left-0 w-full'),
		className
	]}
	{...rest}
>
	<ScrollAreaPrimitive.Thumb
		class={['relative flex-1 rounded-full transition-colors', thumbs[variant]]}
	/>
</ScrollAreaPrimitive.Scrollbar>
