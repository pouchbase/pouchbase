import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import {
	add,
	layout,
	manifest,
	manifestCommand,
	packageDefaults,
	pluginFile,
	tsconfig
} from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({
		pluginFile,
		layout,
		add,
		tsconfig,
		manifest,
		packageDefaults,
		manifestCommand
	})
});
