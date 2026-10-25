import type { PageServerLoad } from './$types';

import { highlightAll } from '#lib/server/highlight.js';

import {
	conflictResponse,
	errors,
	find,
	findMany,
	findManyResponse,
	findResponse,
	insert,
	insertResponse,
	invalidResponse,
	nestedRelations,
	pagination,
	patch,
	relations,
	relationsResponse
} from './snippets';

export const load: PageServerLoad = () => ({
	code: highlightAll({
		find,
		findResponse,
		findMany,
		findManyResponse,
		pagination,
		relations,
		relationsResponse,
		nestedRelations,
		insert,
		insertResponse,
		patch,
		errors,
		invalidResponse,
		conflictResponse
	})
});
