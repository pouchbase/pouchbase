import { describe, expect, it } from 'vitest';

import {
	describeAccept,
	filterFiles,
	iconFor,
	matchesAccept
} from '../../../../../../packages/ui/src/components/inputs/file/file-utils.js';

const file = (name: string, type: string, size = 10) => ({ name, type, size });

describe('matchesAccept', () => {
	it('accepts everything without an accept attribute', () => {
		expect(matchesAccept(file('a.bin', ''), undefined)).toBe(true);
		expect(matchesAccept(file('a.bin', ''), '')).toBe(true);
	});

	it('matches extensions, wildcards and exact types case-insensitively', () => {
		expect(matchesAccept(file('Photo.PNG', ''), '.png')).toBe(true);
		expect(matchesAccept(file('a.jpg', 'image/jpeg'), 'image/*')).toBe(true);
		expect(matchesAccept(file('a.pdf', 'application/pdf'), 'image/*, application/pdf')).toBe(true);
		expect(matchesAccept(file('a.txt', 'text/plain'), 'image/*,.pdf')).toBe(false);
	});
});

describe('filterFiles', () => {
	it('splits accepted files from rejected ones with a message', () => {
		const ok = file('a.png', 'image/png', 100);
		const big = file('b.png', 'image/png', 5000);
		const wrong = file('c.txt', 'text/plain', 10);
		const { accepted, rejection } = filterFiles([ok, big, wrong], 'image/*', 1024);

		expect(accepted).toEqual([ok]);
		expect(rejection).toBe('b.png is larger than 1.0 KB. c.txt is not an accepted file type.');
	});

	it('returns no rejection when everything passes', () => {
		expect(filterFiles([file('a.png', 'image/png')], undefined, undefined).rejection).toBeNull();
	});
});

describe('describeAccept', () => {
	it('summarizes the types and size limit', () => {
		expect(describeAccept('image/*, .pdf', false, 1024)).toBe('image/*, .pdf up to 1.0 KB');
		expect(describeAccept(undefined, false, undefined)).toBe('Any file');
		expect(describeAccept('', true, undefined)).toBe('Any files');
	});
});

describe('iconFor', () => {
	it('picks an icon by MIME type', () => {
		expect(iconFor('image/png')).toBe('lucide:file-image');
		expect(iconFor('application/json')).toBe('lucide:file-text');
		expect(iconFor('application/zip')).toBe('lucide:file-archive');
		expect(iconFor('')).toBe('lucide:file');
	});
});
