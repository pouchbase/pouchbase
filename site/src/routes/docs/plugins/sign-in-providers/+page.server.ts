import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { authProvider, authProviderProfile } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ authProvider, authProviderProfile })
});
