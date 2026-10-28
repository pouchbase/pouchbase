import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { adminClient, apiKeyClient } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ adminClient, apiKeyClient }) });
