import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { mailLinks, oauth, password, session, storage } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ password, oauth, mailLinks, session, storage })
});
