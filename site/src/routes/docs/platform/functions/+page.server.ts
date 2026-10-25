import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { bundle, handler } from './snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ handler, bundle }) });
