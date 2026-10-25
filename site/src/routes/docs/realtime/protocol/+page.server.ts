import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { protocol } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ protocol }) });
