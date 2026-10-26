import { describe, expect, it } from 'vitest';

import {
	blocksToHtml,
	createBlock,
	findBlockTypes,
	inlineHtmlOf,
	postStats,
	type Block
} from '../lib/blocks.js';

const BLOCKS: Block[] = [
	{ id: '1', type: 'paragraph', html: 'Hello <strong>world</strong>' },
	{ id: '2', type: 'heading', level: 3, html: 'A section' },
	{ id: '3', type: 'list', ordered: true, html: '<li>One</li><li>Two</li>' },
	{ id: '4', type: 'quote', html: 'To be or not to be', cite: 'Hamlet' },
	{ id: '5', type: 'code', text: 'if (a < b) {}' },
	{ id: '6', type: 'image', src: 'https://example.com/a.jpg', alt: 'A "cat"', caption: 'Cat' },
	{ id: '7', type: 'separator' },
	{ id: '8', type: 'html', html: '<video src="a.mp4"></video>' },
	{ id: '9', type: 'paragraph', html: '' }
];

describe('blocksToHtml', () => {
	it('writes one element per block and leaves empty blocks out', () => {
		expect(blocksToHtml(BLOCKS).split('\n')).toEqual([
			'<p>Hello <strong>world</strong></p>',
			'<h3>A section</h3>',
			'<ol><li>One</li><li>Two</li></ol>',
			'<blockquote><p>To be or not to be</p><cite>Hamlet</cite></blockquote>',
			'<pre><code>if (a &lt; b) {}</code></pre>',
			'<figure><img src="https://example.com/a.jpg" alt="A &quot;cat&quot;"><figcaption>Cat</figcaption></figure>',
			'<hr>',
			'<video src="a.mp4"></video>'
		]);
	});

	it('writes nothing for an empty post', () => {
		expect(blocksToHtml([createBlock('paragraph'), createBlock('image')])).toBe('');
	});
});

describe('inlineHtmlOf', () => {
	it('keeps the text when a block changes type', () => {
		expect(inlineHtmlOf(BLOCKS[2])).toBe('One<br>Two');
		expect(inlineHtmlOf(BLOCKS[4])).toBe('if (a &lt; b) {}');
		expect(createBlock('list', 'Item')).toMatchObject({ type: 'list', html: '<li>Item</li>' });
		expect(createBlock('code', 'a &amp; b')).toMatchObject({ type: 'code', text: 'a & b' });
	});
});

describe('postStats', () => {
	it('counts the words of the title and the blocks', () => {
		expect(postStats('My post', BLOCKS)).toMatchObject({
			words: 21,
			headings: 1,
			paragraphs: 1,
			blocks: 8,
			minutes: 1
		});
	});
});

describe('findBlockTypes', () => {
	it('finds block types by label and keyword', () => {
		expect(findBlockTypes('').length).toBe(8);
		expect(findBlockTypes('head').map((type) => type.type)).toEqual(['heading']);
		expect(findBlockTypes('hr').map((type) => type.type)).toEqual(['separator']);
		expect(findBlockTypes('nothing')).toEqual([]);
	});
});
