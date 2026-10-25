import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { definePage, page, pagePlugin } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ pagePlugin, page, definePage })
});
