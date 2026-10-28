/** Position of an item relative to the top of the list, measured when a drag starts. */
export type Slot = { top: number; height: number };

/** Distance from the edge of the scroll container that starts scrolling, in pixels. */
const SCROLL_EDGE = 56;
/** Fastest autoscroll, in pixels per frame. */
const MAX_SCROLL_STEP = 16;

/** Measures the items (`[data-sortable-index]`) relative to `origin`, indexed by their index. */
export function measureSlots(elements: HTMLElement[], origin: number) {
	const measured: Slot[] = [];

	for (const element of elements) {
		const rect = element.getBoundingClientRect();

		measured[Number(element.dataset.sortableIndex)] = {
			top: rect.top - origin,
			height: rect.height
		};
	}

	return measured;
}

/** The nearest ancestor that scrolls vertically, or the document's scrolling element. */
export function scrollParent(node: HTMLElement) {
	for (let parent = node.parentElement; parent; parent = parent.parentElement) {
		const { overflowY } = getComputedStyle(parent);

		if (/auto|scroll/.test(overflowY) && parent.scrollHeight > parent.clientHeight) {
			return parent;
		}
	}

	return document.scrollingElement as HTMLElement | null;
}

/** Top of the item dragged from `from` once it lands at `to`. */
export function landing(slots: Slot[], from: number, to: number) {
	const origin = slots[from];
	const slot = slots[to];

	if (!origin || !slot) {
		return 0;
	}

	return to > from ? slot.top + slot.height - origin.height : slot.top;
}

/**
 * Where the item dragged from `from` is after the pointer moved `moved` pixels: its offset, kept
 * within the list so it can't be dragged out of it, and the index it would land at.
 */
export function follow(slots: Slot[], from: number, moved: number) {
	const slot = slots[from];
	const known = slots.filter(Boolean);
	const first = known[0];
	const last = known[known.length - 1];

	const delta = Math.min(
		Math.max(moved, first.top - slot.top),
		last.top + last.height - slot.top - slot.height
	);

	const center = slot.top + delta + slot.height / 2;
	let target = from;

	slots.forEach((other, index) => {
		const middle = other.top + other.height / 2;

		if (index > from && center >= middle) {
			target = Math.max(target, index);
		}

		if (index < from && center <= middle) {
			target = Math.min(target, index);
		}
	});

	return { delta, target };
}

/**
 * How far to scroll this frame while the pointer is near the top or bottom edge of the visible
 * part of the scroll container (`top` to `bottom`); 0 away from the edges.
 */
export function scrollStep(pointerY: number, top: number, bottom: number) {
	let speed = 0;

	if (pointerY < top + SCROLL_EDGE) {
		speed = pointerY - (top + SCROLL_EDGE);
	} else if (pointerY > bottom - SCROLL_EDGE) {
		speed = pointerY - (bottom - SCROLL_EDGE);
	}

	return Math.max(-MAX_SCROLL_STEP, Math.min(MAX_SCROLL_STEP, Math.round(speed / 4)));
}

/**
 * Vertical offset of the item at `index` while the item from `dragging` is over `target`: the
 * dragged item follows the pointer (`delta`), the ones it passed make room (`shift`).
 */
export function offset(
	index: number,
	dragging: number | null,
	target: number | null,
	delta: number,
	shift: number
) {
	if (dragging === null) {
		return 0;
	}

	if (index === dragging) {
		return delta;
	}

	if (target === null) {
		return 0;
	}

	if (index > dragging && index <= target) {
		return -shift;
	}

	if (index < dragging && index >= target) {
		return shift;
	}

	return 0;
}

/** Matches the `duration-200` of the items. */
export const DURATION = 200;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

export function reducedMotion() {
	return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The current top of each element, to slide them from after they moved. */
export function measureTops(elements: HTMLElement[]) {
	return new Map(elements.map((element) => [element, element.getBoundingClientRect().top]));
}

/** Slides the elements from their old place (`before`, from `measureTops`) to their new one. */
export function slideFrom(before: Map<HTMLElement, number>) {
	for (const [element, top] of before) {
		const distance = top - element.getBoundingClientRect().top;

		if (distance) {
			element.animate([{ transform: `translateY(${distance}px)` }, { transform: 'none' }], {
				duration: DURATION,
				easing: EASING
			});
		}
	}
}
