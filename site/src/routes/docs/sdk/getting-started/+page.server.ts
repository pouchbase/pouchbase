import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { client, firstSteps, install, otherRequests } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ install, client, firstSteps, otherRequests })
});
