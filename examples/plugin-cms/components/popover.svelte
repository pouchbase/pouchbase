<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		open: boolean;
		/** The element the popover hangs from; clicks on it don't close the popover. */
		anchor?: HTMLElement | null;
		align?: 'start' | 'end';
		/** Keeps the focus where it is, e.g. in a block whose text is being formatted. */
		keepFocus?: boolean;
		label: string;
		class?: string;
		children: Snippet;
	};

	let {
		open = $bindable(),
		anchor = null,
		align = 'start',
		keepFocus = false,
		label,
		class: className,
		children
	}: Props = $props();

	let panel = $state<HTMLElement | null>(null);

	function handlePointerDown(event: PointerEvent) {
		const target = event.target as Node;

		if (open && !panel?.contains(target) && !anchor?.contains(target)) {
			open = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			open = false;
			anchor?.focus();
		}
	}
</script>

<svelte:window onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

{#if open}
	<div
		bind:this={panel}
		role="dialog"
		aria-label={label}
		tabindex="-1"
		onmousedown={(event) => keepFocus && event.preventDefault()}
		class={[
			'absolute top-full z-40 mt-1.5 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg',
			align === 'start' ? 'left-0' : 'right-0',
			className
		]}
	>
		{@render children()}
	</div>
{/if}
