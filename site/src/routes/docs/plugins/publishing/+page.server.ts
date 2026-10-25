import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { build, ci, publish } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ publish, ci, build }) });
