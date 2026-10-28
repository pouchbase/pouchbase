import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { state, subscribe, subscribeRecord, subscribeTopic } from './snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ subscribe, subscribeRecord, subscribeTopic, state })
});
