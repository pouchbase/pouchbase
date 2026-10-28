import { describe, expect, it } from 'vitest';

import { follow, landing, offset, scrollStep, type Slot } from './sortable-geometry.js';

// Three items of 40px with a 6px gap.
const slots: Slot[] = [
	{ top: 0, height: 40 },
	{ top: 46, height: 40 },
	{ top: 92, height: 40 }
];

describe('landing', () => {
	it('lands on the slot top when moving up and aligns the bottom when moving down', () => {
		expect(landing(slots, 2, 0)).toBe(0);
		expect(landing(slots, 0, 2)).toBe(92);
		expect(landing([], 0, 1)).toBe(0);
	});
});

describe('follow', () => {
	it('keeps the item within the list', () => {
		expect(follow(slots, 0, -100).delta).toBe(0);
		expect(follow(slots, 0, 500).delta).toBe(92);
	});

	it('targets the slot whose middle the item passed', () => {
		expect(follow(slots, 0, 10).target).toBe(0);
		expect(follow(slots, 0, 50).target).toBe(1);
		expect(follow(slots, 2, -60).target).toBe(1);
	});
});

describe('scrollStep', () => {
	it('scrolls near the edges only, capped per frame', () => {
		expect(scrollStep(300, 0, 600)).toBe(0);
		expect(scrollStep(0, 0, 600)).toBe(-14);
		expect(scrollStep(-200, 0, 600)).toBe(-16);
		expect(scrollStep(600, 0, 600)).toBe(14);
	});
});

describe('offset', () => {
	it('moves the dragged item and makes room between it and the target', () => {
		expect(offset(0, null, null, 10, 46)).toBe(0);
		expect(offset(0, 0, 2, 50, 46)).toBe(50);
		expect(offset(1, 0, 2, 50, 46)).toBe(-46);
		expect(offset(1, 2, 0, -50, 46)).toBe(46);
		expect(offset(1, 0, 0, 10, 46)).toBe(0);
	});
});
