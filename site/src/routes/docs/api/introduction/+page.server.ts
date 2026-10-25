import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { error, health, request } from './snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ request, error, health }) });
