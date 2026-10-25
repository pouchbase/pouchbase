import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { conditionTag, whereCompiled, whereObject } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ whereObject, whereCompiled, conditionTag })
});
