import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { invoke, invokeErrors } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ invoke, invokeErrors }) });
