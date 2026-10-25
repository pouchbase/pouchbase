import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { addSetting, readSetting, setting } from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ setting, addSetting, readSetting })
});
