import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import {
	fetchTypes,
	typedClient,
	typedFunctions,
	typedMail,
	typesCli,
	typesFile,
	typesScript
} from '../snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({
		typesCli,
		typesScript,
		typesFile,
		typedClient,
		typedMail,
		typedFunctions,
		fetchTypes
	})
});
