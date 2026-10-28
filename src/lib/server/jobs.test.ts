import { errAsync, okAsync } from 'neverthrow';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runJobStep, StepError, stepResult } from './jobs';

// `claimJob` needs the database and `reasonOf` the SvelteKit runtime; the rest is pure.
vi.mock('./db', () => ({ db: {} }));
vi.mock('./errors', () => ({
	reasonOf: (error: unknown) =>
		error instanceof Error ? error.message : (error as { reason?: string })?.reason
}));

const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

afterEach(() => {
	warn.mockClear();
});

describe('stepResult', () => {
	it('returns the value of an ok result', async () => {
		await expect(stepResult(okAsync(42))).resolves.toBe(42);
	});

	it('ends the step with the service error as a StepError', async () => {
		const failure = stepResult(
			errAsync({ code: 1004, message: 'APP_DATABASE_MISSING', reason: 'no setting' })
		);

		await expect(failure).rejects.toBeInstanceOf(StepError);
		await expect(failure).rejects.toThrow('no setting');
	});
});

describe('runJobStep', () => {
	const options = { label: 'job 1', maxAttempts: 3 };

	it('saves the values with the attempts reset and the lock released', async () => {
		const save = vi.fn().mockResolvedValue(undefined);

		await runJobStep(
			{ id: '1', attempts: 2 },
			options,
			async () => ({ values: { state: 'x' } }),
			save
		);

		expect(save).toHaveBeenCalledWith({ state: 'x', attempts: 0, error: null, lockedUntil: null });
	});

	it('completes the job when the step is done', async () => {
		const save = vi.fn().mockResolvedValue(undefined);

		await runJobStep({ id: '1', attempts: 0 }, options, async () => ({ done: true }), save);

		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'completed', finishedAt: expect.any(Date) })
		);
	});

	it('leaves the row alone when the step saved its own progress', async () => {
		const save = vi.fn();

		await runJobStep({ id: '1', attempts: 0 }, options, async () => null, save);

		expect(save).not.toHaveBeenCalled();
	});

	it('counts a failed attempt and keeps the job running', async () => {
		const save = vi.fn().mockResolvedValue(undefined);

		await runJobStep(
			{ id: '1', attempts: 0 },
			options,
			async () => {
				throw new StepError('The destination was deleted');
			},
			save
		);

		expect(save).toHaveBeenCalledWith({
			attempts: 1,
			error: 'The destination was deleted',
			lockedUntil: null
		});
		expect(warn).toHaveBeenCalledWith('[jobs] job 1: The destination was deleted');
	});

	it('fails the job after the last attempt, after running onFailed', async () => {
		const calls: string[] = [];
		const save = vi.fn().mockImplementation(async () => {
			calls.push('save');
		});

		await runJobStep(
			{ id: '1', attempts: 2 },
			{
				...options,
				onFailed: async () => {
					calls.push('onFailed');
				}
			},
			async () => {
				throw new Error('boom');
			},
			save
		);

		expect(calls).toEqual(['onFailed', 'save']);
		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ attempts: 3, error: 'boom', status: 'failed' })
		);
	});
});
