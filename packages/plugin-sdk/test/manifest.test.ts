import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	PLUGIN_CATEGORIES,
	PLUGIN_CATEGORY_LABELS,
	PLUGIN_FIELD_TYPE_PATTERN,
	PLUGIN_ID_PATTERN,
	pluginFieldTypeId,
	splitPluginFieldType,
	checkCompatibility,
	effectiveCategories,
	isPluginCategory,
	parseBundle,
	parseManifest,
	pluginCollectionName,
	resolveSettings,
	serializeBundle,
	serverCodeIssues,
	splitBundle,
	unknownCategoryIssues
} from '../src/index.js';

import { BUNDLE_FORMAT, BUNDLE_VERSION } from '../src/bundle.js';
import { HOST_MODULE_IDS } from '../src/ui.js';
import { valid } from './fixtures.js';

describe('parseManifest', () => {
	it('accepts a valid manifest and fills in defaults', () => {
		const result = parseManifest(valid);

		expect(result.success).toBe(true);

		if (result.success) {
			expect(result.manifest.permissions.network).toEqual([]);
			expect(result.manifest.contributes.pages).toEqual([]);
			expect(result.manifest.engines).toEqual({});
			expect(result.manifest.categories).toEqual([]);
		}
	});

	it('rejects ids, versions and paths that break the rules', () => {
		const result = parseManifest({
			...valid,
			id: 'Color_Picker',
			version: '^1.0.0',
			contributes: {
				fields: [{ ...valid.contributes!.fields![0]!, input: '../escape.svelte' }]
			}
		});

		expect(result.success).toBe(false);

		if (!result.success) {
			expect(result.issues.map((issue) => issue.path)).toEqual([
				'id',
				'version',
				'contributes.fields.0.input'
			]);
		}
	});

	it('takes the layout of a page, and only a known one', () => {
		const page = (layout: string) =>
			parseManifest({
				...valid,
				contributes: {
					pages: [{ path: 'editor', title: 'Editor', component: 'ui/e.svelte', layout }]
				}
			});
		const full = page('full');

		expect(full.success && full.manifest.contributes.pages[0]?.layout).toBe('full');
		expect(page('huge').success).toBe(false);
	});

	it('rejects duplicate contributions', () => {
		const field = valid.contributes!.fields![0]!;
		const result = parseManifest({ ...valid, contributes: { fields: [field, field] } });

		expect(result.success).toBe(false);
	});

	it('requires server code for auth providers', () => {
		const result = parseManifest({
			...valid,
			server: undefined,
			contributes: { authProviders: [{ id: 'gitlab', label: 'GitLab' }] }
		});

		expect(result.success).toBe(false);

		if (!result.success) {
			expect(result.issues[0]?.path).toBe('server');
		}
	});
});

describe('collections', () => {
	it('names a plugin collection with the plugin id as prefix', () => {
		expect(pluginCollectionName('color-picker', 'palettes')).toBe('color_picker_palettes');
	});

	it('checks the functions: names, length with the prefix, server code', () => {
		const contributes = (functions: unknown[]) => ({
			...valid,
			server: 'server.js',
			contributes: { functions }
		});
		const accepted = parseManifest(contributes([{ name: 'get-posts' }]));

		expect(accepted.success).toBe(true);

		if (accepted.success) {
			expect(accepted.manifest.contributes.functions).toEqual([
				{ name: 'get-posts', requireAuth: false }
			]);
		}

		for (const functions of [
			[{ name: 'Get_Posts' }],
			[{ name: 'a' }, { name: 'a' }],
			[{ name: 'x'.repeat(40) }]
		]) {
			expect(parseManifest(contributes(functions)).success).toBe(false);
		}

		expect(parseManifest({ ...contributes([{ name: 'a' }]), server: undefined }).success).toBe(
			false
		);
	});

	it('fills in the defaults of permissions and collections', () => {
		const result = parseManifest({
			...valid,
			contributes: {
				collections: [{ name: 'palettes', fields: [{ name: 'title', type: 'text' }] }]
			}
		});

		expect(result.success).toBe(true);

		if (result.success) {
			expect(result.manifest.permissions.collections).toEqual({ read: [], write: [] });
			expect(result.manifest.contributes.collections).toEqual([
				{
					name: 'palettes',
					fields: [
						{
							name: 'title',
							type: 'text',
							required: false,
							unique: false,
							defaultValue: null,
							options: {}
						}
					],
					indexes: [],
					rules: {}
				}
			]);
		}
	});

	it('accepts collection names and * in permissions.collections', () => {
		const result = parseManifest({
			...valid,
			permissions: { collections: { read: ['*'], write: ['posts', 'Bad-Name'] } }
		});

		expect(result.success).toBe(false);

		if (!result.success) {
			expect(result.issues.map((issue) => issue.path)).toEqual(['permissions.collections.write.1']);
		}
	});

	it('rejects duplicate, invalid and too long collection names', () => {
		const result = parseManifest({
			...valid,
			contributes: {
				collections: [
					{ name: 'palettes' },
					{ name: 'palettes' },
					{ name: 'Palettes' },
					{ name: 'p'.repeat(60) }
				]
			}
		});

		expect(result.success).toBe(false);

		if (!result.success) {
			expect(result.issues.map((issue) => issue.path)).toEqual([
				'contributes.collections.2.name',
				'contributes.collections.1',
				'contributes.collections.3.name'
			]);
		}
	});
});

describe('auth provider icons', () => {
	const withIcon = (icon: string) => ({
		...valid,
		contributes: { authProviders: [{ id: 'gitlab', label: 'GitLab', icon }] }
	});

	it('accepts an SVG in ui/ and rejects other paths', () => {
		expect(parseManifest(withIcon('ui/gitlab.svg')).success).toBe(true);
		expect(parseManifest(withIcon('ui/gitlab.png')).success).toBe(false);
		expect(parseManifest(withIcon('gitlab.svg')).success).toBe(false);
		expect(parseManifest(withIcon('ui/../gitlab.svg')).success).toBe(false);
	});

	it('requires the icon in the bundle and allows SVG files', () => {
		const result = parseManifest({ ...withIcon('ui/gitlab.svg'), server: 'server.js' });

		expect(result.success).toBe(true);

		if (!result.success) {
			return;
		}

		const bundle = (files: Record<string, string>) =>
			parseBundle(
				serializeBundle({
					format: BUNDLE_FORMAT,
					bundleVersion: BUNDLE_VERSION,
					manifest: result.manifest,
					files
				})
			);

		expect(bundle({ 'server.js': '', 'ui/gitlab.svg': '<svg/>' }).success).toBe(true);

		const missing = bundle({ 'server.js': '' });

		expect(missing.success).toBe(false);

		if (!missing.success) {
			expect(missing.issues[0]?.message).toBe('Missing file: ui/gitlab.svg');
		}
	});
});

describe('plugin icon', () => {
	it('accepts an SVG in ui/ and rejects other paths', () => {
		expect(parseManifest({ ...valid, icon: 'ui/icon.svg' }).success).toBe(true);
		expect(parseManifest({ ...valid, icon: 'ui/icon.png' }).success).toBe(false);
		expect(parseManifest({ ...valid, icon: 'icon.svg' }).success).toBe(false);
	});

	it('requires the icon in the bundle', () => {
		const result = parseManifest({ ...valid, icon: 'ui/icon.svg', server: undefined });

		expect(result.success).toBe(true);

		if (!result.success) {
			return;
		}

		const bundle = (files: Record<string, string>) =>
			parseBundle(
				serializeBundle({
					format: BUNDLE_FORMAT,
					bundleVersion: BUNDLE_VERSION,
					manifest: result.manifest,
					files: { 'ui/color-input.svelte': '', ...files }
				})
			);

		expect(bundle({ 'ui/icon.svg': '<svg/>' }).success).toBe(true);

		const missing = bundle({});

		expect(missing.success).toBe(false);

		if (!missing.success) {
			expect(missing.issues[0]?.message).toBe('Missing file: ui/icon.svg');
		}
	});
});

describe('reserved provider ids', () => {
	it('rejects the ids of the built-in sign-in methods', () => {
		for (const id of ['password', 'email', 'otp']) {
			const result = parseManifest({
				...valid,
				contributes: { authProviders: [{ id, label: 'Mine' }] }
			});

			expect(result.success).toBe(false);
		}
	});
});

describe('serverCodeIssues', () => {
	it('accepts bundled code without imports', () => {
		expect(serverCodeIssues('const a = { imported: 1 }; export { a as default };')).toEqual([]);
		expect(serverCodeIssues('const meta = import.meta.url; export default {};')).toEqual([]);
	});

	it('rejects static, side-effect, re-exported and dynamic imports', () => {
		for (const code of [
			'import { connect } from "cloudflare:sockets";',
			'import{env}from"cloudflare:workers";export default {}',
			'import "cloudflare:sockets";',
			'export * from "node:net";',
			'const m = await import("cloudflare:" + "sockets");'
		]) {
			expect(serverCodeIssues(code)).toHaveLength(1);
		}
	});

	it('makes parseBundle refuse server code with imports', () => {
		const result = parseManifest({ ...valid, server: 'server.js' });

		expect(result.success).toBe(true);

		if (!result.success) {
			return;
		}

		const parsed = parseBundle(
			serializeBundle({
				format: BUNDLE_FORMAT,
				bundleVersion: BUNDLE_VERSION,
				manifest: result.manifest,
				files: {
					'server.js': 'import { connect } from "cloudflare:sockets"; export default {};',
					'ui/color-input.svelte': ''
				}
			})
		);

		expect(parsed.success).toBe(false);
	});
});

describe('splitBundle', () => {
	it('cuts text into parts that join back together', () => {
		expect(splitBundle('', 4)).toEqual([]);
		expect(splitBundle('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
		expect(splitBundle('abcd', 4)).toEqual(['abcd']);
	});

	it('never cuts a surrogate pair', () => {
		const text = 'abc😀def';
		const parts = splitBundle(text, 4);

		expect(parts).toEqual(['abc', '😀de', 'f']);
		expect(parts.join('')).toBe(text);
	});
});

describe('HOST_MODULE_IDS', () => {
	it('lists svelte, the prop types and @pouchbasejs/ui, once each', () => {
		for (const id of ['svelte', 'svelte/store', '@pouchbasejs/plugin-sdk/ui', '@pouchbasejs/ui']) {
			expect(HOST_MODULE_IDS, id).toContain(id);
		}

		for (const id of HOST_MODULE_IDS) {
			expect(id, id).toMatch(/^(?:svelte|@pouchbasejs\/plugin-sdk\/ui|@pouchbasejs\/ui)(?:\/|$)/);
		}

		expect(new Set(HOST_MODULE_IDS).size).toBe(HOST_MODULE_IDS.length);
	});

	it('lists modules that svelte exports', () => {
		const pkg = JSON.parse(
			readFileSync(fileURLToPath(import.meta.resolve('svelte/package.json')), 'utf8')
		) as { exports: Record<string, unknown> };

		for (const id of HOST_MODULE_IDS.filter((id) => id.split('/')[0] === 'svelte')) {
			expect(Object.keys(pkg.exports), id).toContain(id === 'svelte' ? '.' : `./${id.slice(7)}`);
		}
	});

	it('lists every component of @pouchbasejs/ui', () => {
		const components = new URL('../../ui/src/components/', import.meta.url);
		const entries = readdirSync(components, { recursive: true, encoding: 'utf8' })
			.map((path) => path.replaceAll('\\', '/'))
			.filter((path) => path.endsWith('/index.ts'))
			.map((path) => `@pouchbasejs/ui/${path.slice(0, -'/index.ts'.length)}`);

		expect(entries.length).toBeGreaterThan(0);
		// `@pouchbasejs/ui/format` holds helpers (`formatFileSize`), not a component.
		const componentIds = HOST_MODULE_IDS.filter(
			(id) => id.startsWith('@pouchbasejs/ui/') && id !== '@pouchbasejs/ui/format'
		);

		expect([...componentIds].sort()).toEqual(entries.sort());
	});
});

describe('plugin field type ids', () => {
	it('joins and splits <plugin>:<type>', () => {
		expect(pluginFieldTypeId('color-picker', 'color')).toBe('color-picker:color');
		expect(splitPluginFieldType('color-picker:rich_color')).toEqual({
			pluginId: 'color-picker',
			type: 'rich_color'
		});
	});

	it('matches only a valid plugin id and field type', () => {
		for (const id of ['demo:rating', 'color-picker:color', 'a1-b2:x_1', `p:a${'b'.repeat(31)}`]) {
			expect(PLUGIN_FIELD_TYPE_PATTERN.test(id), id).toBe(true);
		}

		for (const id of [
			'text',
			'demo:',
			':rating',
			'Demo:rating',
			'demo:Rating',
			'demo-:rating',
			'demo--x:rating',
			'1demo:rating',
			'demo:1rating',
			'demo:rating-x',
			'demo:rating:x',
			`p:a${'b'.repeat(32)}`
		]) {
			expect(PLUGIN_FIELD_TYPE_PATTERN.test(id), id).toBe(false);
			expect(splitPluginFieldType(id)).toBeNull();
		}
	});

	it('accepts the ids of every valid manifest field', () => {
		const result = parseManifest(valid);

		expect(result.success).toBe(true);

		if (result.success) {
			expect(PLUGIN_ID_PATTERN.test(result.manifest.id)).toBe(true);

			for (const field of result.manifest.contributes.fields) {
				expect(
					PLUGIN_FIELD_TYPE_PATTERN.test(pluginFieldTypeId(result.manifest.id, field.type))
				).toBe(true);
			}
		}
	});
});

describe('categories', () => {
	it('accepts unknown categories that match the pattern, so hosts tolerate new ones', () => {
		const result = parseManifest({ ...valid, categories: ['fields', 'future-thing'] });

		expect(result.success && result.manifest.categories).toEqual(['fields', 'future-thing']);
	});

	it('rejects bad patterns, duplicates and more than three categories', () => {
		const bad = parseManifest({ ...valid, categories: ['Fields'] });
		const duplicate = parseManifest({ ...valid, categories: ['fields', 'fields'] });
		const many = parseManifest({
			...valid,
			categories: ['auth', 'fields', 'pages', 'integrations']
		});

		expect(!bad.success && bad.issues.map((issue) => issue.path)).toEqual(['categories.0']);
		expect(!duplicate.success && duplicate.issues.map((issue) => issue.path)).toEqual([
			'categories.1'
		]);
		expect(many.success).toBe(false);
	});

	it('knows the fixed list and its labels', () => {
		expect(isPluginCategory('auth')).toBe(true);
		expect(isPluginCategory('future-thing')).toBe(false);
		expect(Object.keys(PLUGIN_CATEGORY_LABELS)).toEqual([...PLUGIN_CATEGORIES]);
		expect(unknownCategoryIssues(['auth', 'nope']).map((issue) => issue.path)).toEqual([
			'categories.1'
		]);
	});

	it('implies categories from contributions when none are declared', () => {
		const result = parseManifest(valid);

		expect(result.success && effectiveCategories(result.manifest)).toEqual(['fields']);
		expect(
			effectiveCategories({
				categories: [],
				contributes: {
					authProviders: [{ id: 'gitlab', label: 'GitLab' }],
					pages: [{ path: 'a', title: 'A', component: 'ui/a.svelte', navigation: true }]
				}
			})
		).toEqual(['auth', 'pages']);

		const declared = parseManifest({ ...valid, categories: ['integrations'] });

		expect(declared.success && effectiveCategories(declared.manifest)).toEqual(['integrations']);
	});
});

describe('checkCompatibility', () => {
	const host = { version: '0.4.2', apiVersions: [1] };

	it('accepts a supported API version and a matching range', () => {
		expect(checkCompatibility({ apiVersion: 1, engines: { pouchbase: '>=0.4.0' } }, host)).toBe(
			null
		);
	});

	it('explains an API version from the future', () => {
		expect(checkCompatibility({ apiVersion: 2, engines: {} }, host)).toMatch(/update Pouchbase/);
	});

	it('explains a Pouchbase range that does not match', () => {
		expect(checkCompatibility({ apiVersion: 1, engines: { pouchbase: '>=0.5.0' } }, host)).toMatch(
			/Needs Pouchbase >=0.5.0/
		);
	});
});

describe('settings', () => {
	const withSettings = (settings: unknown[]) => parseManifest({ ...valid, settings });
	const messages = (settings: unknown[]) => {
		const result = withSettings(settings);

		return result.success ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
	};

	it('defaults to no settings, and fills in type and required', () => {
		const empty = parseManifest(valid);

		expect(empty.success && empty.manifest.settings).toEqual([]);

		const result = withSettings([{ key: 'region', label: 'Region', default: 'eu' }]);

		expect(result.success && result.manifest.settings).toEqual([
			{ key: 'region', label: 'Region', type: 'text', required: false, default: 'eu' }
		]);
	});

	it('accepts defaults of the setting type', () => {
		expect(
			messages([
				{ key: 'limit', label: 'Limit', type: 'number', default: 10 },
				{ key: 'enabled', label: 'Enabled', type: 'boolean', default: false },
				{ key: 'endpoint', label: 'Endpoint', type: 'url', default: 'https://api.example.com' },
				{ key: 'token', label: 'Token', type: 'secret', required: true }
			])
		).toEqual([]);
	});

	it('rejects bad keys, duplicates, defaults of another type and secret defaults', () => {
		expect(
			messages([
				{ key: 'Bad-Key', label: 'Bad' },
				{ key: 'limit', label: 'Limit', type: 'number', default: '10' },
				{ key: 'enabled', label: 'Enabled', type: 'boolean', default: 'yes' },
				{ key: 'endpoint', label: 'Endpoint', type: 'url', default: 'not a url' },
				{ key: 'token', label: 'Token', type: 'secret', default: 'abc' },
				{ key: 'name', label: 'Name', default: 1 },
				{ key: 'limit', label: 'Again' },
				{ key: 'color', label: 'Color', type: 'color' }
			])
		).toEqual([
			'settings.0.key: Use lowercase letters, numbers and underscores',
			'settings.1.default: Must be a number',
			'settings.2.default: Must be true or false',
			'settings.3.default: Must be an absolute URL',
			'settings.4.default: A secret setting has no default',
			'settings.5.default: Must be a string',
			expect.stringMatching(/^settings\.7\.type: /)
		]);
		expect(
			messages([
				{ key: 'a', label: 'A' },
				{ key: 'a', label: 'B' }
			])
		).toEqual(['settings.1.key: Duplicate key: a']);
		expect(
			messages(Array.from({ length: 31 }, (_, index) => ({ key: `k${index}`, label: 'K' })))
		).toHaveLength(1);
	});

	it('resolves saved values over defaults, as strings', () => {
		expect(
			resolveSettings(
				[
					{ key: 'region', default: 'eu' },
					{ key: 'limit', default: 10 },
					{ key: 'enabled', default: true },
					{ key: 'token' },
					{ key: 'empty', default: 'x' }
				],
				{ region: 'us', empty: '', removed: 'old' }
			)
		).toEqual({ region: 'us', limit: '10', enabled: 'true', empty: '' });
		expect(resolveSettings(undefined, { a: 'b' })).toEqual({});
	});
});
