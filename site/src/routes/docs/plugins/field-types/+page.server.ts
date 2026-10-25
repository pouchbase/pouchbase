import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { field, fieldInput, fieldPlugin, fieldPreview } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ fieldPlugin, field, fieldInput, fieldPreview })
});
