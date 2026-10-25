import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { authProvider, authProviderPlugin, authProviderProfile } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ authProviderPlugin, authProvider, authProviderProfile })
});
