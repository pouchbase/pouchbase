import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { download, headers, notFound } from './snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ download, headers, notFound }) });
