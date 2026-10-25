import { error, invalid } from '@sveltejs/kit';
import { formatCompileIssue } from '@pouchbasejs/plugin-sdk';
import { z } from 'zod';

import { form, getRequestEvent, query } from '$app/server';

import { pluginIdSchema, pluginSettingsSchema, searchPluginsSchema } from '#lib/schemas/plugins.js';
import { listPluginFieldTypes, listPluginPages } from '#lib/remote/plugins.remote.js';
import { fail } from '#lib/server/errors.js';

function requireUser() {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		error(401, 'Not logged in');
	}

	return locals;
}

/**
 * Plugins in the registry. A registry that can't be reached is not an error of the page: it comes
 * back as `error`, so the installed plugins still show.
 */
export const searchPlugins = query(searchPluginsSchema, async ({ query, page, category }) => {
	const { services } = requireUser();

	const result = await services.plugins().search(query, page, category);

	if (result.isErr()) {
		return {
			list: null,
			error: `The plugin registry can't be reached: ${result.error.data.reason}`
		};
	}

	return { list: result.value, error: null };
});

/** A plugin in the registry with its versions; for the install dialog. */
export const getPluginDetails = query(z.string(), async (id) => {
	const { services } = requireUser();

	const result = await services.plugins().details(id);

	if (result.isErr()) {
		error(502, `The plugin registry can't be reached: ${result.error.data.reason}`);
	}

	if (!result.value) {
		error(404, 'Plugin not found');
	}

	return result.value;
});

export const getInstalledPlugins = query(async () => {
	const { services } = requireUser();

	const result = await services.plugins().installed();

	if (result.isErr()) {
		fail(result.error);
	}

	return result.value;
});

/** Installs the newest version of a plugin that this Pouchbase can run, or updates to it. */
export const installPlugin = form(pluginIdSchema, async ({ id }) => {
	const { services } = requireUser();

	const result = await services.plugins().install(id);

	if (result.isErr()) {
		const { error: failure } = result;

		if (failure.code === 19000) {
			invalid(`The plugin registry can't be reached: ${failure.data.reason}`);
		}

		if (failure.code === 19002) {
			invalid('This plugin has no version that this Pouchbase can install');
		}

		if (failure.code === 19003) {
			invalid(failure.data.reason);
		}

		if (failure.code === 19004) {
			const issue = failure.data.issues[0];
			const detail = issue ? `: ${issue.path ? `${issue.path}: ` : ''}${issue.message}` : '';

			invalid(`The plugin's bundle is not valid${detail}`);
		}

		if (failure.code === 19007) {
			invalid(`The plugin's Worker could not be deployed: ${failure.data.reason}`);
		}

		if (failure.code === 19008) {
			invalid(
				`The sign-in provider ${failure.data.provider} already comes from the plugin ${failure.data.pluginId}`
			);
		}

		if (failure.code === 19009) {
			invalid(`The plugin's server code did not answer as expected: ${failure.data.reason}`);
		}

		if (failure.code === 19014) {
			// The first problems, as `path:line:column: message`, so the author knows where to look.
			const issues = failure.data.issues.slice(0, 3).map(formatCompileIssue);
			const more =
				failure.data.issues.length > issues.length
					? ` (and ${failure.data.issues.length - issues.length} more)`
					: '';

			invalid(`The plugin's components could not be compiled: ${issues.join('; ')}${more}`);
		}

		if (failure.code === 19011) {
			invalid(
				'The Cloudflare account has no workers.dev subdomain yet. Open Workers & Pages in the Cloudflare dashboard once to choose one, then try again.'
			);
		}

		fail(failure);
	}

	void getInstalledPlugins().refresh();
	void listPluginPages().refresh();
	void listPluginFieldTypes().refresh();

	return { name: result.value.name, version: result.value.version };
});

export const uninstallPlugin = form(pluginIdSchema, async ({ id }) => {
	const { services } = requireUser();

	const result = await services.plugins().uninstall(id);

	if (result.isErr()) {
		if (result.error.code === 19010) {
			invalid('Built-in plugins ship with Pouchbase and cannot be removed');
		}

		fail(result.error);
	}

	if (!result.value) {
		error(404, 'Plugin not installed');
	}

	void getInstalledPlugins().refresh();
	void listPluginPages().refresh();
	void listPluginFieldTypes().refresh();

	return { removed: true };
});

/** What the uninstall dialog warns about: the fields that have one of the plugin's types. */
export const getPluginFieldUsage = query(z.string(), async (id) => {
	const { services } = requireUser();

	const result = await services.plugins().fieldUsage(id);

	if (result.isErr()) {
		fail(result.error);
	}

	return result.value;
});

/** The settings of a plugin with their values; secrets only say whether they are set. */
export const getPluginSettings = query(z.string(), async (id) => {
	const { services } = requireUser();

	const result = await services.plugins().settings(id);

	if (result.isErr()) {
		fail(result.error);
	}

	if (!result.value) {
		error(404, 'Plugin not installed');
	}

	return result.value;
});

export const savePluginSettings = form(pluginSettingsSchema, async (data, issue) => {
	const { services } = requireUser();
	const plugins = services.plugins();

	const current = await plugins.settings(data.id);

	if (current.isErr()) {
		fail(current.error);
	}

	if (!current.value) {
		error(404, 'Plugin not installed');
	}

	// One value per setting of the plugin, from the part of the form its type is in.
	const values: Record<string, string | null | undefined> = {};

	for (const setting of current.value.definition) {
		const { key } = setting;

		if (setting.type === 'secret') {
			// Left empty: keep the saved secret.
			values[key] = data._secrets[key] || undefined;
		} else if (setting.type === 'boolean') {
			values[key] = data.flags[key] ? 'true' : 'false';
		} else if (setting.type === 'number') {
			const number = data.numbers[key];

			values[key] = number === undefined ? null : String(number);
		} else {
			values[key] = data.values[key] || null;
		}
	}

	const result = await plugins.saveSettings(data.id, values);

	if (result.isErr()) {
		if (result.error.code === 19018) {
			const types = new Map(current.value.definition.map((setting) => [setting.key, setting.type]));
			const issues = Object.entries(result.error.data.issues).map(([key, message]) => {
				switch (types.get(key)) {
					case 'secret':
						return issue._secrets[key]!(message);
					case 'boolean':
						return issue.flags[key]!(message);
					case 'number':
						return issue.numbers[key]!(message);
					default:
						return issue.values[key]!(message);
				}
			});

			invalid(...issues);
		}

		fail(result.error);
	}

	if (!result.value) {
		error(404, 'Plugin not installed');
	}

	void getPluginSettings(data.id).refresh();
	void getInstalledPlugins().refresh();

	return { saved: true };
});
