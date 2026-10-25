import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { ruleRecipes, ruleUpdate } from '../snippets';

export const load: PageServerLoad = () => ({ code: highlightAll({ ruleUpdate, ruleRecipes }) });
