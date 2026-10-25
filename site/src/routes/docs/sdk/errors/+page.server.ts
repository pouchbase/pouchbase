import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { errors, safe } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ errors, safe }) });
