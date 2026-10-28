import type { CloudflarePlan, UsageRange } from '#lib/cloudflare/limits.js';
import type {
	CloudflareResources,
	LimitTotals,
	UsageSeries,
	WorkerInfo
} from '#lib/cloudflare/types.js';
import type { InsightsDriver, InsightsInput } from '../platform';
import type { ContextError, ServiceError } from './base.service';
import type { ResultAsync } from 'neverthrow';

import { CLOUDFLARE_PLANS } from '#lib/cloudflare/limits.js';

import { DATABASE_NAME, getDatabaseId } from '../db/query';
import { insights, PlatformError } from '../platform';
import { Service } from './base.service';

export type CloudflareError =
	| ContextError
	| ServiceError<5001, 'SET_SETTING_FAILED'>
	| ServiceError<14000, 'CLOUDFLARE_FAILED'>
	| ServiceError<14002, 'WORKER_FORBIDDEN'>
	| ServiceError<14003, 'PLATFORM_UNSUPPORTED'>
	| ServiceError<14011, 'ANALYTICS_FORBIDDEN'>;

/** The API token is not allowed to read this (Cloudflare answers 401/403, or the GraphQL equivalent). */
function isForbidden(error: unknown) {
	return error instanceof PlatformError && (error.status === 401 || error.status === 403);
}

function isPlan(value: string | null): value is CloudflarePlan {
	return (CLOUDFLARE_PLANS as readonly string[]).includes(value ?? '');
}

/**
 * The Cloudflare overview on the dashboard: this installation's resources on the account, the
 * Worker's bindings, usage metrics and the plan whose limits apply. Only available when the app
 * runs on Cloudflare; every other method fails with `PLATFORM_UNSUPPORTED` on other platforms.
 */
export class CloudflareService extends Service {
	/** Whether this installation runs on Cloudflare, so the dashboard can show the overview. */
	available(): ResultAsync<boolean, CloudflareError> {
		return this.run(async () => insights !== null, this.failed);
	}

	/** This installation's databases and bucket, with their status, plus the account's other ones. */
	resources(): ResultAsync<CloudflareResources, CloudflareError> {
		return this.run(async () => this.driver().resources(await this.input()), this.failed);
	}

	/** The deployed Worker with its bindings, or `null` when it is not deployed (yet). */
	worker(): ResultAsync<WorkerInfo | null, CloudflareError> {
		return this.run(async () => {
			const driver = this.driver();

			try {
				return await driver.worker();
			} catch (error) {
				if (isForbidden(error)) {
					this.fail(14002, 'WORKER_FORBIDDEN', { cause: error });
				}

				throw error;
			}
		}, this.failed);
	}

	/** Usage of this installation over the range, as time series for the charts. */
	usage(range: UsageRange): ResultAsync<UsageSeries, CloudflareError> {
		return this.run(async () => {
			const driver = this.driver();
			const input = await this.input();

			return driver.usage(range, input).catch((error: unknown) => this.analyticsFailed(error));
		}, this.failed);
	}

	/** Account-wide usage in the current billing windows, to compare with the plan's limits. */
	limitTotals(): ResultAsync<LimitTotals, CloudflareError> {
		return this.run(async () => {
			const driver = this.driver();

			return driver.limitTotals().catch((error: unknown) => this.analyticsFailed(error));
		}, this.failed);
	}

	/** The Workers plan of the account, as chosen by the admin; defaults to Free. */
	plan(): ResultAsync<CloudflarePlan, CloudflareError> {
		return this.run(async () => {
			const value = await this.must(this.services.settings().get('cloudflare_plan'));

			return isPlan(value) ? value : 'free';
		}, this.failed);
	}

	setPlan(plan: CloudflarePlan): ResultAsync<void, CloudflareError> {
		return this.run(async () => {
			await this.must(this.services.settings().set('cloudflare_plan', plan));
		}, this.failed);
	}

	private failed = (error: unknown) => this.error(14000, 'CLOUDFLARE_FAILED', error);

	private driver(): InsightsDriver {
		if (!insights) {
			this.fail(14003, 'PLATFORM_UNSUPPORTED');
		}

		return insights;
	}

	/** What the driver needs to tell this installation's resources from the rest of the account. */
	private async input(): Promise<InsightsInput> {
		const [systemId, appDatabase, bucketName] = await Promise.all([
			getDatabaseId(),
			this.must(this.services.database().getApp()),
			this.must(this.services.settings().get('files_bucket_name'))
		]);

		return {
			systemDatabase: systemId ? { id: systemId, name: DATABASE_NAME } : null,
			appDatabase,
			bucketName
		};
	}

	private analyticsFailed(error: unknown): never {
		if (isForbidden(error)) {
			this.fail(14011, 'ANALYTICS_FORBIDDEN', { cause: error });
		}

		throw error;
	}
}
