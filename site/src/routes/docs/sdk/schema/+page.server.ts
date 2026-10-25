import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { schema, schemaChanges, transfer } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ schema, schemaChanges, transfer })
});
