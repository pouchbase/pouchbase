import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { invalid, missing, send, sent } from './snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ send, sent, invalid, missing })
});
