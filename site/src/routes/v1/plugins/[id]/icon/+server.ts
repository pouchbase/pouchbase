import type { RequestHandler } from './$types';

import { failureResponse, registryError, registryPreflight } from '#lib/server/registry-http.js';
import { getIcon } from '#lib/server/registry.js';

/**
 * The icon of the newest version of a plugin (`PluginSummary.iconUrl`). SVG can carry scripts, so
 * it is served sandboxed: no scripts, no requests, and never sniffed as another type. `iconUrl` has
 * the version in `?v=`, so a new version gets a new URL.
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const icon = await getIcon(params.id);

		if (icon === null) {
			return registryError(404, 'not_found', `No icon for ${params.id}`);
		}

		return new Response(icon, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'public, max-age=86400',
				'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
				'X-Content-Type-Options': 'nosniff',
				'Cross-Origin-Resource-Policy': 'cross-origin'
			}
		});
	} catch (error) {
		return failureResponse(error);
	}
};

export const OPTIONS: RequestHandler = registryPreflight;
