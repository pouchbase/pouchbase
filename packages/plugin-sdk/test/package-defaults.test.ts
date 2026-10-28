import { describe, expect, it } from 'vitest';

import { withPackageDefaults } from '../src/cli/package-defaults.js';
import { MANIFEST_SCHEMA_URL, parseManifest } from '../src/index.js';
import { valid } from './fixtures.js';

describe('withPackageDefaults', () => {
	const pkg = {
		name: 'color-picker',
		version: '2.0.0',
		description: 'From package.json.',
		license: 'Apache-2.0',
		author: 'Jane Doe <jane@example.com> (https://example.com)',
		homepage: 'https://example.com/color-picker',
		repository: { type: 'git', url: 'git+https://github.com/jane/color-picker.git' },
		keywords: ['color']
	};

	it('fills what the manifest leaves out', () => {
		const manifest: Record<string, unknown> = { ...valid };

		delete manifest.version;
		delete manifest.license;
		const result = parseManifest(withPackageDefaults(manifest, pkg));

		expect(result.success).toBe(true);

		if (result.success) {
			expect(result.manifest.version).toBe('2.0.0');
			expect(result.manifest.license).toBe('Apache-2.0');
			expect(result.manifest.name).toBe('Color picker');
			expect(result.manifest.description).toBe('Adds a color field type.');
			expect(result.manifest.author).toEqual({
				name: 'Jane Doe',
				email: 'jane@example.com',
				url: 'https://example.com'
			});
			expect(result.manifest.repository).toBe('https://github.com/jane/color-picker');
			expect(result.manifest.keywords).toEqual(['color']);
		}
	});

	it('keeps the manifest values and expands repository shorthands', () => {
		const result = withPackageDefaults(
			{ version: '1.0.0', author: { name: 'Manifest' } },
			{ version: '2.0.0', author: { name: 'Package' }, repository: 'github:jane/color-picker' }
		);

		expect(result).toMatchObject({
			version: '1.0.0',
			author: { name: 'Manifest' },
			repository: 'https://github.com/jane/color-picker'
		});
	});

	it('accepts $schema', () => {
		expect(parseManifest({ ...valid, $schema: MANIFEST_SCHEMA_URL }).success).toBe(true);
	});
});
