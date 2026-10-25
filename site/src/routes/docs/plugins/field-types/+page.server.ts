import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { field, fieldInput, fieldPreview } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ field, fieldInput, fieldPreview })
});
