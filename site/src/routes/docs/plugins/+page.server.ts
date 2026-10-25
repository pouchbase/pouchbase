import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { devRegistry, init, templates } from './snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ init, templates, devRegistry })
});
