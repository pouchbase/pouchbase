import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { error, event, protocol } from './snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ protocol, event, error }) });
