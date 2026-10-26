import type { DocsGroup } from './docs/docs-nav';
import type { MarkdownPage } from '#lib/server/markdown.js';

import { fetchMarkdownPage } from '#lib/server/markdown.js';

import { docsTabs, groupOutline } from './docs/docs-nav';

/**
 * `/llms.txt` and `/llms-full.txt` (see https://llmstxt.org): the docs for AI assistants, as an index
 * of the Markdown pages and as all of them in one file.
 */

const summary =
	'An open-source backend on Cloudflare D1 and R2: collections with a database API, users and sign-in, files, realtime, functions, email templates and plugins. It runs as a Cloudflare Worker, or on your own server with Docker or as a single binary.';

function intro(origin: string) {
	return [
		'# Pouchbase',
		`> ${summary}`,
		'Apps use a Pouchbase instance through its REST API or the TypeScript SDK `@pouchbasejs/js-sdk`; plugins extend the instance with `@pouchbasejs/plugin-sdk`. Pouchbase is under active development: until 1.0, APIs and names may change between versions, so prefer these docs over older examples.',
		`Every page is available as Markdown by adding \`.md\` to its URL. ${origin}/llms.txt lists them and ${origin}/llms-full.txt has all of them in one file.`
	].join('\n\n');
}

interface GroupPage {
	label: string;
	href: string;
	page: MarkdownPage;
}

/** Renders every page of a group, labelled with the sections it is in. */
function groupPages(group: DocsGroup, fetch: typeof globalThis.fetch, origin: string) {
	return Promise.all(
		groupOutline(group).map(async (link): Promise<GroupPage> => ({
			// The overview of a section is named after the section.
			label: (link.label === 'Overview' && link.sections.length > 0
				? link.sections
				: [...link.sections, link.label]
			).join(': '),
			href: `${origin}${link.href}`,
			page: await fetchMarkdownPage(fetch, link.href, origin)
		}))
	);
}

/** Moves the headings of a page down a level, so it becomes a section of `llms-full.txt`. */
function demoteHeadings(markdown: string) {
	let fenced = false;

	return markdown
		.split('\n')
		.map((line) => {
			if (line.startsWith('```')) {
				fenced = !fenced;
			} else if (!fenced && /^#{1,5} /.test(line)) {
				return `#${line}`;
			}

			return line;
		})
		.join('\n');
}

export async function llmsIndex(fetch: typeof globalThis.fetch, origin: string) {
	const tabs = await Promise.all(
		docsTabs.map(async (tab) => {
			const groups = await Promise.all(
				tab.groups.map(async (group) => {
					const links = (await groupPages(group, fetch, origin)).map(
						({ label, href, page }) => `- [${label}](${href}.md): ${page.description}`
					);

					return `### ${group.label}\n\n${links.join('\n')}`;
				})
			);

			return [`## ${tab.label}`, tab.description, ...groups].join('\n\n');
		})
	);

	return `${[intro(origin), ...tabs].join('\n\n')}\n`;
}

export async function llmsFull(fetch: typeof globalThis.fetch, origin: string) {
	const groups = await Promise.all(
		docsTabs.flatMap((tab) => tab.groups.map((group) => groupPages(group, fetch, origin)))
	);
	const pages = groups
		.flat()
		.map(({ href, page }) =>
			[
				`## ${page.title}`,
				`Source: ${href}`,
				`> ${page.description}`,
				demoteHeadings(page.markdown)
			].join('\n\n')
		);

	return `${[intro(origin), ...pages].join('\n\n---\n\n')}\n`;
}
