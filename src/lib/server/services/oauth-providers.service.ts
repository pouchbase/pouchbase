import type { OAuthProvider } from '#lib/auth/oauth-providers.js';
import type { ResultAsync } from 'neverthrow';
import type {
	OAuthProviderCredentials,
	OAuthProviderDetails,
	OAuthProviderSettings,
	ProviderJoinRow
} from '../oauth-settings';
import type { ServiceError } from './base.service';

import { eq } from 'drizzle-orm';

import { oauthProviders, pluginAuthProviders, plugins } from '../db';
import { toProviderDetails, toProviderSettings } from '../oauth-settings';
import { Service } from './base.service';

export type {
	OAuthProviderCredentials,
	OAuthProviderDetails,
	OAuthProviderSettings
} from '../oauth-settings';

export type UpdateOAuthProviderInput = {
	enabled: boolean;
	clientId: string;
	/** Empty keeps the stored secret. */
	clientSecret?: string;
};

export type OAuthProvidersError =
	| ServiceError<10000, 'OAUTH_PROVIDERS_FAILED'>
	/** The provider can't be switched on without a client id and secret. */
	| ServiceError<10003, 'PROVIDER_INCOMPLETE'>
	| ServiceError<10004, 'PROVIDER_NOT_FOUND'>;

/**
 * The OAuth providers app users can sign in with, and their client id and secret. Every provider
 * comes from a plugin: `plugin_auth_providers` (kept up to date by `PluginsService`) says which
 * providers exist, `oauth_providers` holds what the admin entered. A row in `oauth_providers`
 * whose plugin is gone is ignored but kept, so the credentials come back when the plugin is
 * installed again.
 */

const JOIN_COLUMNS = {
	provider: pluginAuthProviders,
	credentials: oauthProviders,
	installedVersion: plugins.version
};

export class OAuthProvidersService extends Service {
	private readonly failed = (error: unknown) => this.error(10000, 'OAUTH_PROVIDERS_FAILED', error);

	/** Every provider an installed or built-in plugin contributes, with its settings, by label. */
	list(): ResultAsync<OAuthProviderSettings[], OAuthProvidersError> {
		return this.run(async () => {
			await this.sync();

			const rows = await this.joined();

			return rows.map(toProviderSettings).sort((a, b) => a.label.localeCompare(b.label));
		}, this.failed);
	}

	/**
	 * Label and logo of every known provider, without registering the built-in plugins first;
	 * for showing linked accounts.
	 */
	labels(): ResultAsync<
		Map<OAuthProvider, Pick<OAuthProviderSettings, 'label' | 'iconUrl'>>,
		OAuthProvidersError
	> {
		return this.run(async () => {
			const rows = await this.joined();

			return new Map(
				rows.map((row) => {
					const { label, iconUrl } = toProviderSettings(row);

					return [row.provider.provider, { label, iconUrl }];
				})
			);
		}, this.failed);
	}

	/** A provider with its OAuth config and credentials; `null` when no plugin contributes it. */
	find(provider: OAuthProvider): ResultAsync<OAuthProviderDetails | null, OAuthProvidersError> {
		return this.run(async () => {
			await this.sync();

			const [row] = await this.joined(provider);

			return row ? toProviderDetails(row) : null;
		}, this.failed);
	}

	/** The stored credentials; `null` when no plugin contributes the provider. */
	credentials(
		provider: OAuthProvider
	): ResultAsync<OAuthProviderCredentials | null, OAuthProvidersError> {
		return this.find(provider).map((details) => details?.credentials ?? null);
	}

	update(
		provider: OAuthProvider,
		input: UpdateOAuthProviderInput
	): ResultAsync<void, OAuthProvidersError> {
		return this.run(async () => {
			const current = await this.must(this.credentials(provider));

			if (!current) {
				this.fail(10004, 'PROVIDER_NOT_FOUND');
			}

			const clientId = input.clientId.trim();
			const clientSecret = input.clientSecret?.trim() || current.clientSecret;

			// A provider can only be switched on once it can actually be used.
			if (input.enabled && (!clientId || !clientSecret)) {
				this.fail(10003, 'PROVIDER_INCOMPLETE');
			}

			const values = { enabled: input.enabled, clientId, clientSecret, updatedAt: new Date() };

			await this.db
				.insert(oauthProviders)
				.values({ provider, ...values })
				.onConflictDoUpdate({ target: oauthProviders.provider, set: values });
		}, this.failed);
	}

	/**
	 * Registers the providers of the built-in plugins before they are read. A failure is logged and
	 * the providers registered before are used.
	 */
	private async sync() {
		const synced = await this.services.plugins().ensureEmbedded();

		if (synced.isErr()) {
			console.error('[oauth] Could not register the built-in sign-in providers', synced.error);
		}
	}

	/** `plugin_auth_providers` ⟕ `oauth_providers` ⟕ `plugins`, optionally for one provider. */
	private joined(provider?: OAuthProvider): Promise<ProviderJoinRow[]> {
		const query = this.db
			.select(JOIN_COLUMNS)
			.from(pluginAuthProviders)
			.leftJoin(oauthProviders, eq(oauthProviders.provider, pluginAuthProviders.provider))
			.leftJoin(plugins, eq(plugins.id, pluginAuthProviders.pluginId));

		return provider ? query.where(eq(pluginAuthProviders.provider, provider)) : query;
	}
}
