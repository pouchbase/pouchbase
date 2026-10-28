import type { AnyServiceError } from './services/base.service';
import type { SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable, SQLiteUpdateSetSource } from 'drizzle-orm/sqlite-core';
import type { ResultAsync } from 'neverthrow';

import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from './db';
import { reasonOf } from './errors';

/**
 * Resumable jobs: backups, restores and deployments run in steps, so a step stays within the
 * limits of one Worker invocation and an interrupted job continues where it was. A job is a row
 * with `status`, `attempts`, `error`, `lockedUntil`, `startedAt` and `finishedAt`: `claimJob()`
 * locks the next runnable row, `runJobStep()` runs one step on it and records the outcome.
 */

/** A step is considered stuck (and may be taken over by another request) after this long. */
export const LOCK_MS = 3 * 60 * 1000;

/** A step that can't run; the message is stored with the job and shown in the dashboard. */
export class StepError extends Error {}

/** What went wrong, as the job records it. */
export function describeError(error: unknown) {
	return reasonOf(error) ?? String(error);
}

/** The value of a service result inside a step; its error ends the step as a `StepError`. */
export async function stepResult<T>(result: ResultAsync<T, AnyServiceError>): Promise<T> {
	const settled = await result;

	if (settled.isErr()) {
		throw new StepError(describeError(settled.error));
	}

	return settled.value;
}

type JobTable = SQLiteTable & {
	id: SQLiteColumn;
	status: SQLiteColumn;
	lockedUntil: SQLiteColumn;
	startedAt: SQLiteColumn;
};

/**
 * Locks the oldest running job whose lock is free (or expired) for `LOCK_MS` and returns it, or
 * `null` when there is none. One statement, so two requests never claim the same job.
 */
export async function claimJob<Table extends JobTable>(
	table: Table,
	now: Date,
	condition?: SQL
): Promise<Table['$inferSelect'] | null> {
	const free = or(isNull(table.lockedUntil), lt(table.lockedUntil, now));
	const next = sql`(SELECT ${table.id} FROM ${table} WHERE ${and(eq(table.status, 'running'), free, condition)} ORDER BY ${table.startedAt} LIMIT 1)`;

	const [row] = await db
		.update(table)
		.set({ lockedUntil: new Date(now.getTime() + LOCK_MS) } as SQLiteUpdateSetSource<Table>)
		.where(eq(table.id, next))
		.returning();

	return (row as Table['$inferSelect'] | undefined) ?? null;
}

/** What a step saves on its job when it succeeds; `done` completes the job. */
export type StepOutcome<Values> = { values?: Values; done?: boolean };

/** The job columns a step updates besides its own values. */
export type JobUpdate = {
	attempts: number;
	error: string | null;
	lockedUntil: null;
	status?: 'completed' | 'failed';
	finishedAt?: Date;
};

/**
 * Runs one step of a job and saves the outcome: the step's values with the attempts reset, or the
 * error with one more attempt (and `failed` after `maxAttempts`). The lock is released either
 * way. A step that returns `null` saved its own progress and leaves the row alone.
 */
export async function runJobStep<Values extends object>(
	job: { id: string; attempts: number },
	options: {
		/** For the log, e.g. `backup <id> (export)`. */
		label: string;
		maxAttempts: number;
		/** Runs once the job fails for good, before the failure is saved. */
		onFailed?: (error: unknown) => Promise<void>;
	},
	step: () => Promise<StepOutcome<Values> | null>,
	save: (values: Partial<Values> & JobUpdate) => Promise<unknown>
): Promise<void> {
	try {
		const outcome = await step();

		if (!outcome) {
			return;
		}

		await save({
			...outcome.values,
			attempts: 0,
			error: null,
			lockedUntil: null,
			...(outcome.done && { status: 'completed' as const, finishedAt: new Date() })
		} as Partial<Values> & JobUpdate);
	} catch (error) {
		const attempts = job.attempts + 1;
		const failed = attempts >= options.maxAttempts;

		console.warn(`[jobs] ${options.label}: ${describeError(error)}`);

		if (failed) {
			await options.onFailed?.(error);
		}

		await save({
			attempts,
			error: describeError(error),
			lockedUntil: null,
			...(failed && { status: 'failed' as const, finishedAt: new Date() })
		} as Partial<Values> & JobUpdate);
	}
}
