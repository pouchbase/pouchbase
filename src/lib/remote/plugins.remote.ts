import { error } from '@sveltejs/kit';
import { z } from 'zod';

import { getRequestEvent, query } from '$app/server';

import { fail } from '#lib/server/errors.js';

/**
 * What plugins add to the dashboard everywhere, not only on the Plugins page: the pages in the
 * sidebar, the page a `/plugins/<id>/<path>` URL opens, and the field types for the field
 * settings and the record form.
 */

function requireUser() {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		error(401, 'Not logged in');
	}

	return locals;
}

/** The pages of the installed and built-in plugins that the sidebar links to. */
export const listPluginPages = query(async () => {
	const { services } = requireUser();

	const result = await services.plugins().installed();

	if (result.isErr()) {
		fail(result.error);
	}

	return result.value.flatMap((plugin) =>
		plugin.pages
			.filter((page) => page.navigation)
			.map((page) => ({
				pluginId: plugin.id,
				pluginName: plugin.name,
				iconUrl: page.iconUrl,
				path: page.path,
				title: page.title
			}))
	);
});

/** The page `/plugins/<id>/<path>` opens, with its plugin and the rest of the path. */
export const getPluginPage = query(
	z.object({ id: z.string().min(1).max(64), path: z.string().max(1000) }),
	async ({ id, path }) => {
		const { services } = requireUser();

		const result = await services.plugins().page(id, path);

		if (result.isErr()) {
			fail(result.error);
		}

		if (!result.value) {
			error(404, 'Page not found');
		}

		return result.value;
	}
);

/** The field types of the installed and built-in plugins. */
export const listPluginFieldTypes = query(async () => {
	const { services } = requireUser();

	const result = await services.plugins().fieldTypes();

	if (result.isErr()) {
		fail(result.error);
	}

	return result.value;
});
