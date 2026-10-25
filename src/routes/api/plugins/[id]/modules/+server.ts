import type { RequestHandler } from './$types';

import { json } from '#lib/server/api.js';

/**
 * The compiled UI of an installed plugin for the dashboard's module loader, as one JSON document
 * (`PluginModules`). Only for a signed-in admin. The dashboard asks for `?v=<version>`, so the
 * answer for a version can be cached for good; a request for another version than the installed
 * one is answered but not cached. Built-in plugins have none: their components come with the
 * dashboard.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) {
		return json({ message: 'Sign in to the dashboard to load plugin components' }, 401);
	}

	const result = await locals.services.plugins().modules(params.id);

	if (result.isErr()) {
		console.error(`[plugins] Could not load the modules of ${params.id}`, result.error);

		return json({ message: "Could not load the plugin's components" }, 500);
	}

	if (!result.value) {
		return json({ message: 'Plugin not found' }, 404);
	}

	const requested = url.searchParams.get('v');

	return new Response(JSON.stringify(result.value), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control':
				requested === result.value.version
					? 'private, max-age=31536000, immutable'
					: 'private, no-cache',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
