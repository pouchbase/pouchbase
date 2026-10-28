import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { mailErrors, sendCustomMail, sendMail } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ sendMail, sendCustomMail, mailErrors })
});
