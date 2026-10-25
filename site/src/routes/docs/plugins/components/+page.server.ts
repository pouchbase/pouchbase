import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { icons, iconSrc } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ icons, iconSrc }) });
