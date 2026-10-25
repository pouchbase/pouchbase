import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { quickStart, state, subscribe, subscribeRecord, subscribeTopic } from './snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ quickStart, subscribe, subscribeRecord, subscribeTopic, state })
});
