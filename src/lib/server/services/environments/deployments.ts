import type { PlanStep, PlanWarning } from '#lib/environments/diff.js';
import type { deployments } from '../../db';
import type { Services } from '../services';

import { eq } from 'drizzle-orm';

import { backups, db, deployments as deploymentsTable } from '../../db';
import { describeError } from '../../errors';
import { claimJob, runJobStep } from '../../jobs';
import { applyStep } from './apply-step';

/**
 * A deployment is a publish to this instance: the steps of a plan, run one per request by the
 * publishing instance and by the scheduled tick (see `../../jobs.ts`).
 */

/** Failed attempts of a step before the deployment fails. */
const MAX_ATTEMPTS = 3;

type DeploymentRow = typeof deployments.$inferSelect;

/** A publish to this instance, as its status is reported to the publishing instance. */
export type Deployment = {
	id: string;
	source: string;
	status: 'running' | 'completed' | 'failed';
	/** Steps that have run, of `total`. */
	done: number;
	total: number;
	/** The step that runs next (or failed); `null` when every step has run. */
	current: PlanStep | null;
	warnings: PlanWarning[];
	/** Waiting for the backup made before the first step. */
	backingUp: boolean;
	backupId: string | null;
	error: string | null;
	startedAt: Date;
	finishedAt: Date | null;
};

export function toDeployment(row: DeploymentRow, backingUp = false): Deployment {
	return {
		id: row.id,
		source: row.source,
		status: row.status,
		done: row.done,
		total: row.steps.length,
		current: row.steps[row.done] ?? null,
		warnings: row.warnings,
		backingUp,
		backupId: row.backupId,
		error: row.error,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt
	};
}

/** Whether the deployment still waits for the backup made before its first step. */
export async function backingUp(row: DeploymentRow) {
	if (!row.backupId || row.done > 0 || row.status !== 'running') {
		return false;
	}

	const [backup] = await db
		.select({ status: backups.status })
		.from(backups)
		.where(eq(backups.id, row.backupId));

	return backup?.status === 'running';
}

/**
 * Runs one step of the running deployment, or steps of the backup it waits for, within `budget`
 * milliseconds. Returns whether there was a deployment to run.
 */
export async function runDeploymentStep(services: Services, budget: number) {
	const row = await claimJob(deploymentsTable, new Date());

	if (!row) {
		return false;
	}

	const save = (values: Partial<DeploymentRow>) =>
		db
			.update(deploymentsTable)
			.set({ lockedUntil: null, ...values })
			.where(eq(deploymentsTable.id, row.id));

	await runJobStep<{ done: number }>(
		row,
		{ label: `deployment ${row.id} step ${row.done}`, maxAttempts: MAX_ATTEMPTS },
		async () => {
			if (row.backupId && row.done === 0) {
				const [backup] = await db
					.select({ status: backups.status, error: backups.error })
					.from(backups)
					.where(eq(backups.id, row.backupId));

				if (backup?.status === 'failed') {
					// Trying again won't help: the deployment fails right away.
					await save({
						error: `The backup before publishing failed: ${backup.error ?? 'unknown error'}`,
						status: 'failed',
						finishedAt: new Date()
					});

					return null;
				}

				if (backup?.status === 'running') {
					// The backup runs its own steps; the deployment continues once it is completed.
					const advanced = await services.backups().advance(budget);

					if (advanced.isErr()) {
						console.warn(
							`[environments] backup of deployment ${row.id}: ${describeError(advanced.error)}`
						);
					}

					await save({});

					return null;
				}
			}

			const step = row.steps[row.done];

			if (step) {
				await applyStep(services, step);
			}

			const done = row.done + 1;

			return { values: { done }, done: done >= row.steps.length };
		},
		save
	);

	return true;
}
