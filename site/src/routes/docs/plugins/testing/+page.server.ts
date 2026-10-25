import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import {
	debugLogs,
	devInRepo,
	devRegistry,
	routeErrors,
	testField,
	testRoute,
	testSettings,
	vitestConfig
} from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({
		devRegistry,
		devInRepo,
		vitestConfig,
		testRoute,
		testField,
		testSettings,
		debugLogs,
		routeErrors
	})
});
