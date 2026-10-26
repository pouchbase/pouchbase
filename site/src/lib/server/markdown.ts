import { NodeHtmlMarkdown } from 'node-html-markdown';
import { HTMLElement, parse } from 'node-html-parser';

/**
 * Turns a rendered docs page into Markdown, for AI assistants (`/llms.txt`, `/llms-full.txt` and
 * `/docs/<page>.md`). The docs are prerendered, so this runs during the build. The components mark
 * what needs more than plain HTML-to-Markdown:
 *
 * - `data-markdown="content"`: the text of the page (`DocsPage`), without its header and pager.
 * - `data-markdown="skip"`: left out, e.g. a live preview of a component.
 * - `data-code-block="<title>"`: a code block; `data-language` holds the language of a source,
 *   `data-kind` the kind of a terminal line.
 * - `data-callout="<variant>"`: a callout, which becomes a quote; `data-callout-title` its title.
 */

export interface MarkdownPage {
	title: string;
	description: string;
	markdown: string;
}

const converter = new NodeHtmlMarkdown({ bulletMarker: '-', codeFence: '```' });

/** Titles of code blocks that only name the language, which the fence already says. */
const languageTitles = new Set(['typescript', 'javascript', 'json', 'bash', 'terminal', 'html']);

/**
 * Converts the HTML of the docs page at `url` (on the public origin). Links become absolute, and
 * links to other docs pages point to their Markdown version.
 */
export function pageToMarkdown(html: string, url: URL): MarkdownPage {
	const root = parse(html);
	const title = root.querySelector('article h1')?.text.trim() ?? '';
	const description =
		root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
	const content = root.querySelector('[data-markdown="content"]');

	if (!content) {
		return { title, description, markdown: '' };
	}

	for (const element of content.querySelectorAll(
		'[data-markdown="skip"], [aria-hidden="true"], svg, script, style'
	)) {
		element.remove();
	}

	for (const link of content.querySelectorAll('a[href]')) {
		link.setAttribute('href', absoluteHref(link.getAttribute('href')!, url));
	}

	// Code blocks and callouts become placeholders, replaced after the conversion, so the converter
	// never sees their markup.
	const blocks: string[] = [];

	function placeholder(element: HTMLElement, markdown: string) {
		element.replaceWith(`<p>MARKDOWNBLOCK${blocks.length}</p>`);
		blocks.push(markdown);
	}

	for (const element of content.querySelectorAll('[data-code-block]')) {
		placeholder(element, codeBlock(element));
	}

	for (const element of content.querySelectorAll('[data-callout]')) {
		const title = element.querySelector('[data-callout-title]');

		if (title) {
			title.replaceWith(`<p><strong>${title.innerHTML}</strong></p>`);
		}

		const text = converter.translate(element.innerHTML).trim();

		placeholder(element, text.replace(/^/gm, '> ').replace(/^> $/gm, '>'));
	}

	const markdown = converter
		.translate(content.innerHTML)
		.replace(/MARKDOWNBLOCK(\d+)/g, (_, index) => blocks[Number(index)])
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	return { title, description, markdown };
}

/** A page as a Markdown document of its own, with its title and description. */
export function markdownDocument({ title, description, markdown }: MarkdownPage) {
	return `# ${title}\n\n> ${description}\n\n${markdown}\n`;
}

function absoluteHref(href: string, base: URL) {
	const url = new URL(href, base);

	if (url.origin === base.origin && url.pathname.startsWith('/docs/')) {
		url.pathname = `${url.pathname}.md`;
	}

	return url.href;
}

/** A fenced code block, after a line with its title unless that only names the language. */
function codeBlock(element: HTMLElement) {
	const title = element.getAttribute('data-code-block')?.trim() ?? '';
	const source = element.querySelector('[data-language]');
	let language = 'bash';
	let code: string;

	if (source) {
		language = source.getAttribute('data-language')!;
		code = source.childNodes
			.filter((node) => node instanceof HTMLElement)
			.map((line) => line.text)
			.join('\n');
	} else {
		code = element
			.querySelectorAll('[data-kind]')
			.map((line) => {
				const text = line.text.trim();

				return line.getAttribute('data-kind') === 'continued' ? `  ${text}` : text;
			})
			.join('\n');
	}

	const fence = `\`\`\`${language}\n${code}\n\`\`\``;

	return title && !languageTitles.has(title.toLowerCase()) ? `${title}:\n\n${fence}` : fence;
}

/** Renders the docs page at `href` with the `fetch` of a request, and converts it. */
export async function fetchMarkdownPage(
	fetch: typeof globalThis.fetch,
	href: string,
	origin: string
) {
	const response = await fetch(href);

	if (!response.ok) {
		throw new Error(`Rendering ${href} for Markdown failed with ${response.status}`);
	}

	return pageToMarkdown(await response.text(), new URL(href, origin));
}
