import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import {
	collectionPermissions,
	collectionsInPlugin,
	notesCollection,
	notesRoute,
	testPouch
} from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({
		collectionPermissions,
		collectionsInPlugin,
		notesCollection,
		notesRoute,
		testPouch
	})
});
