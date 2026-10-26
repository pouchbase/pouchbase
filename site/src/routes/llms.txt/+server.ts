import type { RequestHandler } from './$types';

import { llmsIndex } from '../llms';
import { SITE_URL } from '../site-nav';

export const prerender = true;

export const GET: RequestHandler = async ({ fetch }) =>
	new Response(await llmsIndex(fetch, SITE_URL), {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
