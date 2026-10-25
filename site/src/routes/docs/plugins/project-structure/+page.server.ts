import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { add, layout, manifest, manifestCommand, packageDefaults } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ layout, add, manifest, packageDefaults, manifestCommand })
});
