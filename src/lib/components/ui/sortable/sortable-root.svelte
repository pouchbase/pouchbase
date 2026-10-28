<script module lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type Props = HTMLAttributes<HTMLUListElement> & {
		/** Number of items, for the position announced after a move. */
		count: number;
		/** Called with the old and the new index; the caller moves the item in its data. */
		onReorder: (from: number, to: number) => void;
		/** Column labels above the items; use the same widths and gaps as the items to line them up. */
		header?: Snippet;
	};
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { on } from 'svelte/events';
	import { setSortableContext } from './sortable-context';
	import {
		DURATION,
		follow,
		landing,
		measureSlots,
		measureTops,
		offset as itemOffset,
		reducedMotion,
		scrollParent,
		scrollStep,
		slideFrom,
		type Slot
	} from './sortable-geometry';

	let { count, onReorder, header, children, class: className, ...rest }: Props = $props();

	let list: HTMLUListElement | null = null;

	let dragging = $state<number | null>(null);
	let target = $state<number | null>(null);
	let delta = $state(0);
	let dropping = $state(false);
	let announcement = $state('');

	// Measured when a drag starts, relative to the top of the list.
	let slots = $state<Slot[]>([]);
	let shift = 0;
	let startY = 0;
	let pointerY = 0;
	let startScroll = 0;
	let scroller: HTMLElement | null = null;
	let frame = 0;
	let cleanup: (() => void)[] = [];

	const placeholder = $derived(
		dragging !== null && target !== null && slots[dragging]
			? { top: landing(slots, dragging, target), height: slots[dragging].height }
			: null
	);

	function items() {
		return list ? [...list.querySelectorAll<HTMLElement>(':scope > [data-sortable-index]')] : [];
	}

	function announce(to: number) {
		announcement = `Moved to position ${to + 1} of ${count}`;
	}

	/** Follows the pointer and works out where the dragged item would land. */
	function update() {
		if (dragging === null || dropping) {
			return;
		}

		const scrolled = (scroller?.scrollTop ?? 0) - startScroll;

		({ delta, target } = follow(slots, dragging, pointerY - startY + scrolled));
	}

	/** Scrolls the container while the pointer is near its top or bottom edge. */
	function autoscroll() {
		if (dragging === null || dropping) {
			return;
		}

		if (scroller) {
			const rect = scroller.getBoundingClientRect();
			const step = scrollStep(pointerY, Math.max(rect.top, 0), Math.min(rect.bottom, innerHeight));

			if (step) {
				scroller.scrollTop += step;
				update();
			}
		}

		frame = requestAnimationFrame(autoscroll);
	}

	function stopListening() {
		cancelAnimationFrame(frame);
		cleanup.forEach((stop) => stop());
		cleanup = [];
	}

	/** Lets go of the dragged item: it settles into its slot, then the list is reordered. */
	async function release(commit: boolean) {
		if (dragging === null || dropping) {
			return;
		}

		stopListening();

		const from = dragging;
		const to = commit ? (target ?? from) : from;

		target = to;
		dropping = true;
		delta = landing(slots, from, to) - slots[from].top;

		if (!reducedMotion()) {
			await new Promise((resolve) => setTimeout(resolve, DURATION));
		}

		if (to !== from) {
			onReorder(from, to);
			announce(to);
		}

		// Cleared together with the reorder, so the items don't jump.
		dragging = null;
		target = null;
		delta = 0;
		dropping = false;
	}

	setSortableContext({
		get dragging() {
			return dragging;
		},
		get dropping() {
			return dropping;
		},
		offset(index) {
			return itemOffset(index, dragging, target, delta, shift);
		},
		grab(index, event) {
			if (dragging !== null || dropping || event.button !== 0 || !list) {
				return;
			}

			const measured = measureSlots(items(), list.getBoundingClientRect().top);

			if (!measured[index]) {
				return;
			}

			// Stops text from being selected; the handle keeps focus for the arrow keys.
			event.preventDefault();
			(event.currentTarget as HTMLElement | null)?.focus();

			slots = measured;
			shift = measured[index].height + (parseFloat(getComputedStyle(list).rowGap) || 0);
			scroller = scrollParent(list);
			startScroll = scroller?.scrollTop ?? 0;
			startY = pointerY = event.clientY;
			dragging = index;
			target = index;
			delta = 0;

			cleanup = [
				on(window, 'pointermove', (move) => {
					pointerY = move.clientY;
					update();
				}),
				on(window, 'pointerup', () => release(true)),
				on(window, 'pointercancel', () => release(false)),
				on(window, 'blur', () => release(false)),
				on(
					window,
					'keydown',
					(key) => {
						if (key.key === 'Escape') {
							// Cancels the drag without closing the sheet or dialog around the list.
							key.preventDefault();
							key.stopPropagation();
							release(false);
						}
					},
					{ capture: true }
				)
			];

			if (scroller) {
				cleanup.push(
					on(scroller === document.scrollingElement ? window : scroller, 'scroll', update)
				);
			}

			frame = requestAnimationFrame(autoscroll);
		},
		async move(from, to) {
			if (dragging !== null || from === to || to < 0 || to >= count) {
				return;
			}

			const before = measureTops(items());

			onReorder(from, to);
			announce(to);
			await tick();

			if (!reducedMotion()) {
				slideFrom(before);
			}
		}
	});

	$effect(() => stopListening);
</script>

<div
	data-dragging={dragging !== null || undefined}
	class={[
		'flex flex-col gap-1 data-dragging:cursor-grabbing data-dragging:select-none data-dragging:**:cursor-grabbing',
		className
	]}
>
	{#if header}
		<div
			class="flex h-6 items-center gap-3 border-x border-transparent pr-2 pl-1 text-xs font-medium text-zinc-500"
			aria-hidden="true"
		>
			{@render header()}
		</div>
	{/if}

	<div class="relative">
		{#if placeholder}
			<!-- Where the dragged item lands when it is let go. -->
			<div
				class="pointer-events-none absolute inset-x-0 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/60 transition-[top] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
				style:top="{placeholder.top}px"
				style:height="{placeholder.height}px"
			></div>
		{/if}

		<ul {...rest} bind:this={list} class="relative flex flex-col gap-1.5">
			{@render children?.()}
		</ul>
	</div>
</div>

<div class="sr-only" aria-live="polite">{announcement}</div>
