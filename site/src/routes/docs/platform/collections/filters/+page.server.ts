import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { filterError, multiline } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ multiline, filterError }) });
