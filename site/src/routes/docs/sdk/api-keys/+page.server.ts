import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { apiKeyClient, asService } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ apiKeyClient, asService }) });
