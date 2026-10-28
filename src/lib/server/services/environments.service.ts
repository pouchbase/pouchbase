import type { BackupsError } from './backups.service';
import type { ContextError, ServiceError } from './base.service';
import type { Deployment } from './environments/deployments';
import type { RemoteFailed, RemoteNotLinked } from './environments/remote';
import type { Plan, PlanStep } from '#lib/environments/diff.js';
import type { Environment } from '#lib/environments/snapshot.js';
import type { Snapshot, SnapshotCollection } from '#lib/schemas/environments.js';
import type { ResultAsync } from 'neverthrow';

import { desc, eq } from 'drizzle-orm';

import { diff, planSeverity } from '#lib/environments/diff.js';
import { ENVIRONMENTS, snapshotHash } from '#lib/environments/snapshot.js';

import { generateToken, hashToken } from '../crypto';
import { deployments, deployTokens } from '../db';
import { describeError } from '../jobs';
import { Service } from './base.service';
import { applyStep } from './environments/apply-step';
import { backingUp, runDeploymentStep, toDeployment } from './environments/deployments';
import {
	fetchPlan,
	fetchSnapshot,
	linkedRemote,
	parseDeployment,
	request
} from './environments/remote';
import { readCollections, readSnapshot, SNAPSHOT_KEYS } from './environments/snapshot';

export type { Deployment } from './environments/deployments';

/**
 * Environments: a development instance publishes its schema and configuration to a production
 * instance, or pulls them from it. Both describe themselves as a snapshot (`./environments/
 * snapshot.ts`), `#lib/environments/diff` turns two snapshots into a plan, and a deployment runs
 * the plan's steps through the services (`./environments/apply-step.ts`), one per request.
 */

type Failed = ServiceError<20000, 'ENVIRONMENTS_FAILED'>;
type TokenNotFound = ServiceError<20002, 'DEPLOY_TOKEN_NOT_FOUND'>;
type TargetChanged = ServiceError<20004, 'TARGET_CHANGED'>;
type NotConfirmed = ServiceError<20005, 'DESTRUCTIVE_NOT_CONFIRMED'>;
type JobRunning = ServiceError<20006, 'JOB_RUNNING'>;
type SourceChanged = ServiceError<20010, 'SOURCE_CHANGED'>;
/** A step of `runSteps` failed; the steps before it are done. */
type StepFailed = ServiceError<20011, 'STEP_FAILED'> & { data: { done: number; reason: string } };
type SettingFailed = ServiceError<5001, 'SET_SETTING_FAILED'>;

type SnapshotError = Failed | ContextError;
type RemoteError = SnapshotError | RemoteNotLinked | RemoteFailed | SourceChanged;
type ApplyError =
	| SnapshotError
	| TargetChanged
	| NotConfirmed
	| JobRunning
	| Extract<BackupsError, { code: 16000 | 16001 | 16003 }>;

export type EnvironmentsError =
	ApplyError | RemoteError | TokenNotFound | StepFailed | SettingFailed;

/** `publish`: from this instance to the linked one. `pull`: from the linked one into this one. */
export type Direction = 'publish' | 'pull';

/** A plan for this instance, with the hash of the state it was made for. */
export type TargetPlan = {
	plan: Plan;
	/** `snapshotHash` of this instance when the plan was made. */
	targetHash: string;
};

/** A plan between this instance and the linked one, with the hashes `startRemote` checks. */
export type RemotePlan = TargetPlan & {
	sourceHash: string;
	remote: { url: string; environment: string | null };
};

/** What publishing to this instance needs. */
export type ApplyInput = {
	source: Snapshot;
	/** `TargetPlan.targetHash` of the plan that was shown. */
	targetHash: string;
	/** The plan removes data or code, and the user agreed to that. */
	confirmDestructive: boolean;
	tokenId: string | null;
};

/** A deploy token as the Environments page lists it; the token itself is only shown once. */
export type DeployToken = {
	id: string;
	name: string;
	createdAt: Date;
	lastUsedAt: Date | null;
};

/** Prefix of deploy tokens, so they are recognisable (e.g. by secret scanners). */
const TOKEN_PREFIX = 'pbdt_';

/** `last_used_at` is written at most this often per token. */
const LAST_USED_INTERVAL = 60 * 1000;

const TOKEN_COLUMNS = {
	id: deployTokens.id,
	name: deployTokens.name,
	createdAt: deployTokens.createdAt,
	lastUsedAt: deployTokens.lastUsedAt
};

export class EnvironmentsService extends Service {
	/** Whether this instance is for development or production; `null` when it isn't set. */
	get(): ResultAsync<Environment | null, ServiceError<5000, 'GET_SETTING_FAILED'>> {
		return this.services
			.settings()
			.get('environment')
			.map((value) =>
				ENVIRONMENTS.includes(value as Environment) ? (value as Environment) : null
			);
	}

	/** `null` turns environments off for this instance. */
	set(environment: Environment | null): ResultAsync<void, SettingFailed> {
		return this.services.settings().set('environment', environment ?? '');
	}

	/** The schema and configuration of this instance, as it is sent to another instance. */
	snapshot(): ResultAsync<Snapshot, SnapshotError> {
		return this.run(() => this.readSnapshot(), this.failed);
	}

	/** The collections of this instance as a snapshot has them: fields, indexes and settings. */
	collections(): ResultAsync<SnapshotCollection[], SnapshotError> {
		return this.run(async () => {
			const appDatabase = await this.must(this.services.database().requireApp());

			return readCollections(appDatabase.id);
		}, this.failed);
	}

	/** What applying `source` to this instance would change. */
	plan(source: Snapshot): ResultAsync<TargetPlan, SnapshotError> {
		return this.run(() => this.planFor(source), this.failed);
	}

	/**
	 * Runs the steps of a plan in this request, in order, as the steps of a publish run. Stops at
	 * the first step that fails; `done` says how many ran before it. Refused while a publish, pull,
	 * backup or restore runs.
	 */
	runSteps(
		steps: PlanStep[]
	): ResultAsync<void, Failed | JobRunning | StepFailed | Extract<BackupsError, { code: 16000 }>> {
		let done = 0;

		return this.run(
			async () => {
				await this.requireIdle();

				for (const step of steps) {
					await applyStep(this.services, step);
					done++;
				}
			},
			(error): StepFailed => ({
				...this.error(20011, 'STEP_FAILED', error),
				data: { done, reason: describeError(error) }
			})
		);
	}

	/** The deploy tokens other instances use to reach this one, newest first. */
	tokens(): ResultAsync<DeployToken[], Failed> {
		return this.run(
			() => this.db.select(TOKEN_COLUMNS).from(deployTokens).orderBy(desc(deployTokens.createdAt)),
			this.failed
		);
	}

	/** Creates a deploy token; `token` can't be read back later. */
	createToken(name: string): ResultAsync<DeployToken & { token: string }, Failed> {
		return this.run(async () => {
			const token = `${TOKEN_PREFIX}${generateToken()}`;
			const [row] = await this.db
				.insert(deployTokens)
				.values({ name, tokenHash: await hashToken(token) })
				.returning(TOKEN_COLUMNS);

			return { ...row, token };
		}, this.failed);
	}

	deleteToken(id: string): ResultAsync<void, Failed | TokenNotFound> {
		return this.run(async () => {
			const rows = await this.db
				.delete(deployTokens)
				.where(eq(deployTokens.id, id))
				.returning({ id: deployTokens.id });

			if (!rows.length) {
				this.fail(20002, 'DEPLOY_TOKEN_NOT_FOUND');
			}
		}, this.failed);
	}

	/** The deploy token with this value, `null` when there is none; records that it was used. */
	verifyToken(token: string): ResultAsync<DeployToken | null, Failed> {
		return this.run(async () => {
			if (!token.startsWith(TOKEN_PREFIX)) {
				return null;
			}

			const [row] = await this.db
				.select(TOKEN_COLUMNS)
				.from(deployTokens)
				.where(eq(deployTokens.tokenHash, await hashToken(token)));

			if (!row) {
				return null;
			}

			const now = new Date();

			if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_INTERVAL) {
				await this.db
					.update(deployTokens)
					.set({ lastUsedAt: now })
					.where(eq(deployTokens.id, row.id));
			}

			return { ...row, lastUsedAt: now };
		}, this.failed);
	}

	/**
	 * Starts publishing `source` to this instance: checks that the instance is still in the state the
	 * plan was made for, makes a backup when a backup destination exists, and records the steps. The
	 * steps run in `advance` (called by the publishing instance and by the scheduled tick).
	 */
	apply(input: ApplyInput): ResultAsync<Deployment, ApplyError> {
		return this.run(() => this.start(input), this.failed);
	}

	/** A deployment by id; `null` when there is none. */
	deployment(id: string): ResultAsync<Deployment | null, Failed> {
		return this.run(async () => {
			const [row] = await this.db.select().from(deployments).where(eq(deployments.id, id));

			return row ? toDeployment(row, await backingUp(row)) : null;
		}, this.failed);
	}

	/** The latest deployments, newest first. */
	deployments(limit = 20): ResultAsync<Deployment[], Failed> {
		return this.run(async () => {
			const rows = await this.db
				.select()
				.from(deployments)
				.orderBy(desc(deployments.startedAt))
				.limit(limit);

			return rows.map((row) => toDeployment(row));
		}, this.failed);
	}

	/** Whether a deployment is running. */
	running(): ResultAsync<boolean, Failed> {
		return this.run(() => this.isRunning(), this.failed);
	}

	/**
	 * Runs steps of the running deployment for up to `budget` milliseconds (always at least one).
	 * A step that fails is tried again later; the deployment fails after a few attempts in a row.
	 * Returns whether a deployment is still running.
	 */
	advance(budget: number): ResultAsync<{ running: boolean }, Failed> {
		return this.run(() => this.runSome(budget), this.failed);
	}

	/** The instance this one publishes to and pulls from; `null` when none is linked. */
	remote(): ResultAsync<
		{ url: string; hasToken: boolean } | null,
		ServiceError<5000, 'GET_SETTING_FAILED'>
	> {
		return this.services
			.settings()
			.getMany(['environment_remote_url', 'environment_remote_token'])
			.map((values) =>
				values.environment_remote_url
					? { url: values.environment_remote_url, hasToken: !!values.environment_remote_token }
					: null
			);
	}

	/**
	 * Links another instance after checking that its URL and deploy token work. Returns the
	 * environment of that instance.
	 */
	link(
		url: string,
		token: string
	): ResultAsync<{ environment: string | null }, Failed | RemoteFailed | SettingFailed> {
		return this.run(async () => {
			const base = url.trim().replace(/\/+$/, '');
			const snapshot = await fetchSnapshot(
				{ url: base, token },
				'Not a Pouchbase instance, or a different version'
			);

			await this.must(
				this.services
					.settings()
					.setMany({ environment_remote_url: base, environment_remote_token: token })
			);

			return { environment: snapshot.environment };
		}, this.failed);
	}

	unlink(): ResultAsync<void, SettingFailed> {
		return this.services
			.settings()
			.setMany({ environment_remote_url: '', environment_remote_token: '' });
	}

	/**
	 * What publishing this instance to the linked one (`publish`), or pulling the linked one into
	 * this one (`pull`), would change. Changes nothing.
	 */
	remotePlan(direction: Direction): ResultAsync<RemotePlan, RemoteError> {
		return this.run(async () => {
			const { remote, source, sourceHash } = await this.remoteSnapshots(direction);

			if (direction === 'pull') {
				const { plan, targetHash } = await this.planFor(source);

				return {
					plan,
					targetHash,
					sourceHash,
					remote: { url: remote.url, environment: source.environment }
				};
			}

			const { plan, targetHash, environment } = await fetchPlan(remote, source);

			return { plan, targetHash, sourceHash, remote: { url: remote.url, environment } };
		}, this.failed);
	}

	/**
	 * Starts publishing (`publish`) or pulling (`pull`) as planned. Refused when the source changed
	 * since the plan was made; the target checks the same for itself.
	 */
	startRemote(
		direction: Direction,
		input: { sourceHash: string; targetHash: string; confirmDestructive: boolean }
	): ResultAsync<Deployment, RemoteError | ApplyError> {
		return this.run(async () => {
			const { remote, source, sourceHash } = await this.remoteSnapshots(direction);

			if (sourceHash !== input.sourceHash) {
				this.fail(20010, 'SOURCE_CHANGED');
			}

			if (direction === 'pull') {
				return this.start({
					source,
					targetHash: input.targetHash,
					confirmDestructive: input.confirmDestructive,
					tokenId: null
				});
			}

			const body = await request(remote, 'POST', '/internal/environment/apply', {
				snapshot: source,
				targetHash: input.targetHash,
				confirmDestructive: input.confirmDestructive
			});

			return parseDeployment(body);
		}, this.failed);
	}

	/**
	 * Runs steps of a publish (on the linked instance) or a pull (on this one) and returns its
	 * status; called until it is done.
	 */
	advanceRemote(
		direction: Direction,
		id: string,
		budget: number
	): ResultAsync<Deployment | null, RemoteError> {
		return this.run(async () => {
			if (direction === 'pull') {
				await this.runSome(budget);

				return this.must(this.deployment(id));
			}

			const remote = await linkedRemote(this.services);
			const path = `/internal/environment/deployments/${encodeURIComponent(id)}`;

			return parseDeployment(await request(remote, 'POST', path));
		}, this.failed);
	}

	private failed = (error: unknown): Failed => this.error(20000, 'ENVIRONMENTS_FAILED', error);

	private async readSnapshot() {
		const [appDatabase, values] = await Promise.all([
			this.must(this.services.database().requireApp()),
			this.must(this.services.settings().getMany(SNAPSHOT_KEYS))
		]);

		return readSnapshot(this.services, appDatabase.id, values);
	}

	private async planFor(source: Snapshot): Promise<TargetPlan> {
		const target = await this.readSnapshot();

		return { plan: diff(source, target), targetHash: await snapshotHash(target) };
	}

	/** Records a deployment for `input` (see `apply`). */
	private async start(input: ApplyInput): Promise<Deployment> {
		await this.requireIdle();

		const { plan, targetHash } = await this.planFor(input.source);

		if (targetHash !== input.targetHash) {
			this.fail(20004, 'TARGET_CHANGED');
		}

		if (planSeverity(plan) === 'destructive' && !input.confirmDestructive) {
			this.fail(20005, 'DESTRUCTIVE_NOT_CONFIRMED');
		}

		// Nothing to back up for an empty plan.
		const backupId = plan.steps.length ? await this.backupFirst() : null;
		const [row] = await this.db
			.insert(deployments)
			.values({
				tokenId: input.tokenId,
				source: input.source.instance,
				steps: plan.steps,
				warnings: plan.warnings,
				backupId,
				...(!plan.steps.length && { status: 'completed' as const, finishedAt: new Date() })
			})
			.returning();

		return toDeployment(row, !!backupId);
	}

	/** Starts a backup to the first destination, when there is one; returns its id. */
	private async backupFirst() {
		const backups = this.services.backups();
		const [destination] = await this.must(backups.destinations());

		return destination ? this.must(backups.start(destination.id, false)) : null;
	}

	/** The source snapshot of a publish (this instance) or a pull (the linked one), with its hash. */
	private async remoteSnapshots(direction: Direction) {
		const remote = await linkedRemote(this.services);
		const source =
			direction === 'publish'
				? await this.readSnapshot()
				: await fetchSnapshot(remote, 'The linked instance runs a different version');

		return { remote, source, sourceHash: await snapshotHash(source) };
	}

	private async runSome(budget: number) {
		const deadline = Date.now() + budget;

		do {
			if (!(await runDeploymentStep(this.services, Math.max(deadline - Date.now(), 0)))) {
				break;
			}
		} while (Date.now() < deadline);

		return { running: await this.isRunning() };
	}

	private async isRunning() {
		const rows = await this.db
			.select({ id: deployments.id })
			.from(deployments)
			.where(eq(deployments.status, 'running'))
			.limit(1);

		return rows.length > 0;
	}

	/** Fails with `JOB_RUNNING` while a deployment, backup or restore runs. */
	private async requireIdle() {
		if ((await this.isRunning()) || (await this.must(this.services.backups().running()))) {
			this.fail(20006, 'JOB_RUNNING');
		}
	}
}
