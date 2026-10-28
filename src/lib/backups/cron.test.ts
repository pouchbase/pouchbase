import { describe, expect, it } from 'vitest';

import { CRON_PRESETS, describeCron, nextRun, parseCron } from './cron';

function next(expression: string, after: string) {
	const cron = parseCron(expression);

	expect(cron).not.toBeNull();

	return nextRun(cron!, new Date(after))?.toISOString();
}

describe('parseCron', () => {
	it('parses every preset', () => {
		for (const preset of CRON_PRESETS) {
			expect(parseCron(preset.value)).not.toBeNull();
		}
	});

	it('expands ranges, lists and steps', () => {
		const cron = parseCron('0-30/10,45 1-3 * * 1,5')!;

		expect([...cron.minutes]).toEqual([0, 10, 20, 30, 45]);
		expect([...cron.hours]).toEqual([1, 2, 3]);
		expect([...cron.weekdays]).toEqual([1, 5]);
		expect(cron.anyDay).toBe(true);
		expect(cron.anyWeekday).toBe(false);
	});

	it('treats `5/10` as from 5 to the end and 7 as Sunday', () => {
		expect([...parseCron('5/10 * * * *')!.minutes]).toEqual([5, 15, 25, 35, 45, 55]);
		expect([...parseCron('0 0 * * 7')!.weekdays]).toEqual([0]);
	});

	it('rejects invalid expressions', () => {
		for (const expression of [
			'0 3 * *',
			'60 * * * *',
			'0 24 * * *',
			'0 0 0 * *',
			'*/0 * * * *',
			'10-5 * * * *',
			'a * * * *'
		]) {
			expect(parseCron(expression)).toBeNull();
		}
	});
});

describe('nextRun', () => {
	it('finds the next minute after the given time', () => {
		expect(next('*/15 * * * *', '2026-10-28T10:07:00Z')).toBe('2026-10-28T10:15:00.000Z');
		expect(next('*/15 * * * *', '2026-10-28T10:15:00Z')).toBe('2026-10-28T10:30:00.000Z');
		expect(next('*/15 * * * *', '2026-10-28T10:15:30Z')).toBe('2026-10-28T10:30:00.000Z');
	});

	it('moves to the next day, week and month', () => {
		expect(next('0 3 * * *', '2026-10-28T10:00:00Z')).toBe('2026-10-29T03:00:00.000Z');
		expect(next('0 3 * * *', '2026-10-28T02:59:00Z')).toBe('2026-10-28T03:00:00.000Z');
		// 2026-10-28 is a Wednesday.
		expect(next('0 3 * * 0', '2026-10-28T10:00:00Z')).toBe('2026-11-01T03:00:00.000Z');
		expect(next('0 3 1 * *', '2026-10-28T10:00:00Z')).toBe('2026-11-01T03:00:00.000Z');
	});

	it('matches either day field when both are restricted', () => {
		// The 15th, or a Monday (2026-11-02): the Monday comes first.
		expect(next('0 0 15 * 1', '2026-10-28T10:00:00Z')).toBe('2026-11-02T00:00:00.000Z');
		expect(next('0 0 15 * 1', '2026-11-10T10:00:00Z')).toBe('2026-11-15T00:00:00.000Z');
	});

	it('gives up on an expression that never matches', () => {
		expect(next('0 0 31 2 *', '2026-10-28T10:00:00Z')).toBeUndefined();
	});
});

describe('describeCron', () => {
	it('labels presets and shows other expressions as is', () => {
		expect(describeCron('0 3 * * *')).toBe('Every day at 03:00 UTC');
		expect(describeCron('5 4 * * *')).toBe('5 4 * * * (UTC)');
	});
});
