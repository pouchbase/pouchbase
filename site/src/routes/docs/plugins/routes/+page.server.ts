import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { outsideApi, route, routeCurl, routeParams, routeUser } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ route, routeCurl, routeParams, routeUser, outsideApi })
});
