import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { invalid, missing, send, sendCustom, sent } from './snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ send, sendCustom, sent, invalid, missing })
});
