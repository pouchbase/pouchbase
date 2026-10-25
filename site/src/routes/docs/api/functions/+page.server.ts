import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { call, callResponse, path, signIn } from './snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ call, callResponse, path, signIn })
});
