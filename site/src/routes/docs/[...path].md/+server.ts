import type { EntryGenerator, RequestHandler } from './$types';

import { fetchMarkdownPage, markdownDocument } from '#lib/server/markdown.js';

import { SITE_URL } from '../../site-nav';
import { allDocsLinks } from '../docs-nav';

// Every docs page as Markdown at its own path plus `.md`, for AI assistants.
export const prerender = true;

export const entries: EntryGenerator = () =>
	allDocsLinks().map((link) => ({ path: link.href.replace(/^\/docs\//, '') }));

export const GET: RequestHandler = async ({ params, fetch }) => {
	const page = await fetchMarkdownPage(fetch, `/docs/${params.path}`, SITE_URL);

	return new Response(markdownDocument(page), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
};
