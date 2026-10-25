import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import { install, layout, theme, usage, viteConfig, virtualModule } from './snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({ install, theme, viteConfig, layout, virtualModule, usage })
});
