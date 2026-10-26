import type { IconName } from './icons.js';

/**
 * The editor's blocks, like the blocks of the WordPress editor. A post is stored as plain HTML in
 * its Rich text field (`blocksToHtml`), so apps and the dashboard's record form read it as is; the
 * editor turns that HTML back into blocks when it opens a post (`htmlToBlocks`), whoever wrote it.
 */
export type Block =
	| { id: string; type: 'paragraph'; html: string }
	| { id: string; type: 'heading'; level: HeadingLevel; html: string }
	/** `html` holds the `<li>` items. */
	| { id: string; type: 'list'; ordered: boolean; html: string }
	| { id: string; type: 'quote'; html: string; cite: string }
	| { id: string; type: 'code'; text: string }
	| { id: string; type: 'image'; src: string; alt: string; caption: string }
	| { id: string; type: 'separator' }
	/** Anything else, kept as written: the Custom HTML block. */
	| { id: string; type: 'html'; html: string };

export type BlockType = Block['type'];

export type HeadingLevel = 2 | 3 | 4;

/** The blocks with inline formatting, edited in place (`contenteditable`). */
export type TextBlock = Extract<Block, { type: 'paragraph' | 'heading' | 'list' | 'quote' }>;

export function isTextBlock(block: Block): block is TextBlock {
	return ['paragraph', 'heading', 'list', 'quote'].includes(block.type);
}

/** The block types of the inserter and the `/` menu, in their order. */
export const BLOCK_TYPES: {
	type: BlockType;
	label: string;
	description: string;
	icon: IconName;
	/** Other words that find it in the `/` menu. */
	keywords: string[];
}[] = [
	{
		type: 'paragraph',
		label: 'Paragraph',
		description: 'Start with the basic building block of all narrative.',
		icon: 'pilcrow',
		keywords: ['text']
	},
	{
		type: 'heading',
		label: 'Heading',
		description: 'Introduce new sections and organize content.',
		icon: 'heading',
		keywords: ['title', 'subtitle', 'h2', 'h3', 'h4']
	},
	{
		type: 'list',
		label: 'List',
		description: 'An organized collection of items displayed in a specific order.',
		icon: 'list',
		keywords: ['bullet', 'numbered', 'ordered', 'ul', 'ol']
	},
	{
		type: 'quote',
		label: 'Quote',
		description: 'Give quoted text visual emphasis.',
		icon: 'textQuote',
		keywords: ['blockquote', 'cite']
	},
	{
		type: 'image',
		label: 'Image',
		description: 'Insert an image to make a visual statement.',
		icon: 'image',
		keywords: ['photo', 'picture', 'img']
	},
	{
		type: 'code',
		label: 'Code',
		description: 'Display code snippets that respect your spacing and tabs.',
		icon: 'code',
		keywords: ['pre', 'snippet']
	},
	{
		type: 'separator',
		label: 'Separator',
		description: 'Create a break between ideas or sections with a horizontal line.',
		icon: 'separatorHorizontal',
		keywords: ['hr', 'divider', 'line']
	},
	{
		type: 'html',
		label: 'Custom HTML',
		description: 'Add custom HTML code.',
		icon: 'codeXml',
		keywords: ['embed', 'raw']
	}
];

export function blockId() {
	return crypto.randomUUID();
}

/** An empty block of a type; `html` carries over the text when a block changes type. */
export function createBlock(type: BlockType, html = ''): Block {
	const id = blockId();

	switch (type) {
		case 'paragraph':
			return { id, type, html };
		case 'heading':
			return { id, type, level: 2, html };
		case 'list':
			return { id, type, ordered: false, html: `<li>${html}</li>` };
		case 'quote':
			return { id, type, html, cite: '' };
		case 'code':
			return { id, type, text: html ? textOf(html) : '' };
		case 'image':
			return { id, type, src: '', alt: '', caption: '' };
		case 'separator':
			return { id, type };
		case 'html':
			return { id, type, html };
	}
}

/**
 * The inline HTML of a text block, to carry over when it becomes another type: the items of a
 * list are joined with line breaks.
 */
export function inlineHtmlOf(block: Block) {
	switch (block.type) {
		case 'list':
			return block.html
				.replace(/^\s*<li[^>]*>/i, '')
				.replace(/<\/li>\s*$/i, '')
				.replace(/<\/li>\s*<li[^>]*>/gi, '<br>');
		case 'paragraph':
		case 'heading':
		case 'quote':
			return block.html;
		case 'code':
			return escapeHtml(block.text);
		default:
			return '';
	}
}

/** `true` for a text block without text, which `blocksToHtml` leaves out. */
export function isEmptyBlock(block: Block) {
	switch (block.type) {
		case 'paragraph':
		case 'heading':
		case 'quote':
		case 'list':
			return textOf(block.html).trim() === '';
		case 'html':
			return block.html.trim() === '';
		case 'code':
			return block.text.trim() === '';
		case 'image':
			return block.src.trim() === '';
		case 'separator':
			return false;
	}
}

/** The HTML of a post: one element per block, empty blocks left out. */
export function blocksToHtml(blocks: Block[]) {
	return blocks
		.filter((block) => !isEmptyBlock(block))
		.map(blockToHtml)
		.join('\n');
}

function blockToHtml(block: Block) {
	switch (block.type) {
		case 'paragraph':
			return `<p>${block.html}</p>`;
		case 'heading':
			return `<h${block.level}>${block.html}</h${block.level}>`;
		case 'list': {
			const tag = block.ordered ? 'ol' : 'ul';

			return `<${tag}>${block.html}</${tag}>`;
		}
		case 'quote': {
			const cite = block.cite.trim() ? `<cite>${escapeHtml(block.cite.trim())}</cite>` : '';

			return `<blockquote><p>${block.html}</p>${cite}</blockquote>`;
		}
		case 'code':
			return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
		case 'image': {
			const img = `<img src="${escapeAttribute(block.src.trim())}" alt="${escapeAttribute(block.alt)}">`;
			const caption = block.caption.trim()
				? `<figcaption>${escapeHtml(block.caption.trim())}</figcaption>`
				: '';

			return `<figure>${img}${caption}</figure>`;
		}
		case 'separator':
			return '<hr>';
		case 'html':
			return block.html;
	}
}

/** Text of an HTML string, without tags; for word counts and emptiness, not for display. */
export function textOf(html: string) {
	return html
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<\/(p|li|h\d|blockquote|figcaption)>/gi, ' ')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
}

export function escapeHtml(text: string) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(text: string) {
	return escapeHtml(text).replace(/"/g, '&quot;');
}

/** Counts for the Details of the editor's sidebar; reading time at 200 words a minute. */
export function postStats(title: string, blocks: Block[]) {
	const text = [title, ...blocks.map((block) => textOf(blockToHtml(block)))].join(' ');
	const words = text.split(/\s+/).filter(Boolean).length;

	return {
		words,
		characters: text.replace(/\s+/g, ' ').trim().length,
		headings: blocks.filter((block) => block.type === 'heading').length,
		paragraphs: blocks.filter((block) => block.type === 'paragraph' && !isEmptyBlock(block)).length,
		blocks: blocks.filter((block) => !isEmptyBlock(block)).length,
		minutes: Math.max(1, Math.round(words / 200))
	};
}

/** The tags that stay as they are in inline HTML; others are unwrapped, keeping their text. */
const INLINE_TAGS = new Set([
	'A',
	'B',
	'BR',
	'CODE',
	'EM',
	'I',
	'KBD',
	'MARK',
	'S',
	'STRONG',
	'SUB',
	'SUP',
	'U'
]);

/** Elements whose content is dropped with them. */
const DROPPED_TAGS = new Set([
	'SCRIPT',
	'STYLE',
	'IFRAME',
	'OBJECT',
	'EMBED',
	'TEMPLATE',
	'NOSCRIPT',
	'SVG',
	'MATH'
]);

/**
 * Inline HTML that is safe to put into the editor (`contenteditable`): only `INLINE_TAGS`, no
 * attributes but the `href` of an http(s), mailto or relative link. Needs the DOM.
 */
export function sanitizeInline(html: string) {
	const template = document.createElement('template');

	template.innerHTML = html;
	cleanChildren(template.content);

	return template.innerHTML.trim();
}

function cleanChildren(parent: ParentNode) {
	for (const node of [...parent.childNodes]) {
		if (node.nodeType === Node.COMMENT_NODE) {
			node.remove();
			continue;
		}

		if (!(node instanceof Element)) {
			continue;
		}

		if (DROPPED_TAGS.has(node.tagName)) {
			node.remove();
			continue;
		}

		cleanChildren(node);

		if (!INLINE_TAGS.has(node.tagName)) {
			// Block elements inside a block (a <p> in an <li>) become line breaks between their text.
			const isBlock = /^(P|DIV|H\d|LI|UL|OL|BLOCKQUOTE|PRE|FIGURE|TABLE|TR)$/.test(node.tagName);

			if (isBlock && node.nextSibling) {
				node.after(document.createElement('br'));
			}

			node.replaceWith(...node.childNodes);
			continue;
		}

		const href = node.getAttribute('href');

		for (const attribute of [...node.attributes]) {
			node.removeAttribute(attribute.name);
		}

		if (node.tagName === 'A' && href && /^(https?:|mailto:|\/|#)/i.test(href.trim())) {
			node.setAttribute('href', href.trim());
		}
	}
}

/**
 * The blocks of a post's HTML, from this editor or another (the dashboard's Rich text editor,
 * an import): known elements become their block, anything else a Custom HTML block. Needs the DOM.
 */
export function htmlToBlocks(html: string): Block[] {
	const body = new DOMParser().parseFromString(html, 'text/html').body;
	const blocks: Block[] = [];
	let loose: Node[] = [];

	// Text and inline elements between blocks make a paragraph together.
	function flushLoose() {
		const holder = document.createElement('div');

		holder.append(...loose);
		loose = [];

		const inline = sanitizeInline(holder.innerHTML);

		if (textOf(inline).trim()) {
			blocks.push({ id: blockId(), type: 'paragraph', html: inline });
		}
	}

	for (const node of [...body.childNodes]) {
		const block = node instanceof Element ? elementToBlock(node) : null;

		if (block === undefined || (block === null && node.nodeType !== Node.COMMENT_NODE)) {
			loose.push(node);
			continue;
		}

		flushLoose();

		if (block) {
			blocks.push(block);
		}
	}

	flushLoose();

	return blocks;
}

/** The block of a top-level element; `undefined` for inline content, `null` to drop it. */
function elementToBlock(element: Element): Block | null | undefined {
	const id = blockId();
	const tag = element.tagName;

	if (INLINE_TAGS.has(tag)) {
		return undefined;
	}

	if (DROPPED_TAGS.has(tag)) {
		return null;
	}

	switch (tag) {
		case 'P':
			return { id, type: 'paragraph', html: sanitizeInline(element.innerHTML) };
		case 'H1':
		case 'H2':
		case 'H3':
		case 'H4':
		case 'H5':
		case 'H6': {
			const level = Math.min(4, Math.max(2, Number(tag[1]))) as HeadingLevel;

			return { id, type: 'heading', level, html: sanitizeInline(element.innerHTML) };
		}
		case 'UL':
		case 'OL': {
			const items = [...element.children]
				.filter((child) => child.tagName === 'LI')
				.map((li) => `<li>${sanitizeInline(li.innerHTML)}</li>`);

			return { id, type: 'list', ordered: tag === 'OL', html: items.join('') };
		}
		case 'BLOCKQUOTE': {
			const copy = element.cloneNode(true) as Element;
			const cite = copy.querySelector('cite');

			cite?.remove();

			return {
				id,
				type: 'quote',
				html: sanitizeInline(copy.innerHTML),
				cite: cite?.textContent?.trim() ?? ''
			};
		}
		case 'PRE':
			return { id, type: 'code', text: element.textContent ?? '' };
		case 'HR':
			return { id, type: 'separator' };
		case 'IMG':
		case 'FIGURE': {
			const img = tag === 'IMG' ? element : element.querySelector('img');
			const onlyImage =
				tag === 'IMG' ||
				[...element.children].every((child) => ['IMG', 'FIGCAPTION'].includes(child.tagName));

			if (img && onlyImage) {
				return {
					id,
					type: 'image',
					src: img.getAttribute('src') ?? '',
					alt: img.getAttribute('alt') ?? '',
					caption: element.querySelector('figcaption')?.textContent?.trim() ?? ''
				};
			}

			return { id, type: 'html', html: element.outerHTML };
		}
		default:
			return { id, type: 'html', html: element.outerHTML };
	}
}

/** The block types the `/` menu offers for `query`, the text after the slash. */
export function findBlockTypes(query: string) {
	const q = query.trim().toLowerCase();

	return BLOCK_TYPES.filter(
		(type) =>
			!q ||
			type.label.toLowerCase().includes(q) ||
			type.keywords.some((keyword) => keyword.startsWith(q))
	);
}
