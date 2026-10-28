import { describe, expect, it } from 'vitest';

import {
	MAX_ARCHIVE_FILE_SIZE,
	readArchive,
	tarEnd,
	tarHeader,
	tarPadding,
	tarSize
} from './archive';

const modified = new Date('2026-10-28T10:00:00Z');

function field(header: Uint8Array, start: number, length: number) {
	return new TextDecoder().decode(header.subarray(start, start + length)).replace(/\0.*$/s, '');
}

function archive(files: { name: string; content: string }[]) {
	const encoder = new TextEncoder();
	const parts: Uint8Array<ArrayBuffer>[] = [];

	for (const file of files) {
		const bytes = encoder.encode(file.content);

		parts.push(
			tarHeader(file.name, bytes.length, modified),
			bytes,
			new Uint8Array(tarPadding(bytes.length))
		);
	}

	parts.push(tarEnd());

	return new Blob(parts);
}

describe('tarHeader', () => {
	it('writes a ustar header with a valid checksum', () => {
		const header = tarHeader('app.sql', 1234, modified);

		expect(header.length).toBe(512);
		expect(field(header, 0, 100)).toBe('app.sql');
		expect(parseInt(field(header, 124, 12), 8)).toBe(1234);
		expect(parseInt(field(header, 136, 12), 8)).toBe(modified.getTime() / 1000);
		expect(field(header, 257, 6)).toBe('ustar');

		const stored = parseInt(field(header, 148, 8).trim(), 8);
		const blank = new Uint8Array(header);

		blank.fill(0x20, 148, 156);
		expect(blank.reduce((total, byte) => total + byte, 0)).toBe(stored);
	});

	it('refuses files a header cannot describe', () => {
		expect(() => tarHeader('big', MAX_ARCHIVE_FILE_SIZE + 1, modified)).toThrow();
	});
});

describe('tarPadding and tarSize', () => {
	it('pads every file to a block and ends with two blocks', () => {
		expect(tarPadding(0)).toBe(0);
		expect(tarPadding(1)).toBe(511);
		expect(tarPadding(512)).toBe(0);
		expect(tarSize([])).toBe(1024);
		expect(tarSize([1, 512])).toBe(512 + 512 + 512 + 512 + 1024);
	});
});

describe('readArchive', () => {
	it('finds the files from the headers alone', async () => {
		const entries = await readArchive(
			archive([
				{ name: 'manifest.json', content: '{}' },
				{ name: './system.sql', content: 'SELECT 1;' },
				{ name: 'app.sql', content: '' }
			])
		);

		expect(entries).toEqual([
			{ name: 'manifest.json', offset: 512, size: 2 },
			{ name: 'system.sql', offset: 512 * 3, size: 9 },
			{ name: 'app.sql', offset: 512 * 5, size: 0 }
		]);
	});

	it('rejects something that is not a tar archive', async () => {
		await expect(readArchive(new Blob([new Uint8Array(1024).fill(0x41)]))).rejects.toThrow(
			'This is not a tar archive'
		);
	});
});
