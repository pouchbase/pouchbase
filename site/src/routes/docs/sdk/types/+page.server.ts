import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { fetchTypes, typedClient, typesCli, typesFile, typesScript } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ typesCli, typesScript, typesFile, typedClient, fetchTypes })
});
