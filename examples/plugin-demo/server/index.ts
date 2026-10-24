import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import { rating } from './rating.js';
import { echo, githubStatus, info } from './routes.js';

/**
 * The entry the manifest's `server` points to. `pouchbase-plugin build` bundles it with the files
 * it imports into one `server.js`. Every key of `fields` matches a field in the manifest.
 */
export default definePlugin({
	fields: {
		rating
	},
	routes: {
		// Served at /api/plugins/demo/<path>; the page calls them with api.fetch('<path>').
		'GET /info': info,
		'POST /echo': echo,
		'GET /github-status': githubStatus
	}
});
