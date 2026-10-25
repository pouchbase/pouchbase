import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { outsideApi, route, routeCurl, routeParams, routesPlugin, routeUser } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ routesPlugin, route, routeCurl, routeParams, routeUser, outsideApi })
});
