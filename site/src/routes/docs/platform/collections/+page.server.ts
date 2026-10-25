import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { record } from './snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ record }) });
