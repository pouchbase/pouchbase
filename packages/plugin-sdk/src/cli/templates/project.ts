import { MANIFEST_FILE, MANIFEST_SCHEMA_URL } from '../../manifest.js';
import { providerTest } from './auth-provider.js';
import { emptyTest } from './empty.js';
import { EXAMPLE_PROVIDER_HOST, providerEntry, type PluginEntry } from './entries.js';
import { COLOR_TEST, colorFieldEntry } from './field.js';
import { helloEntries, helloTest } from './page.js';
import { PLUGIN_FILE, pluginFileSource, type SettingTemplate } from './plugin-file.js';
import { camelCase, json, providerIdFor, title, type Files } from './source.js';

/** A new plugin project: the files of each template, with its README, tsconfig and vitest config. */

/** Starting points for `pouchbase-plugin init --template <name>`. */
export const TEMPLATES = ['field', 'page', 'auth-provider', 'empty'] as const;

export type PluginTemplate = (typeof TEMPLATES)[number];

export const TEMPLATE_DESCRIPTIONS: Record<PluginTemplate, string> = {
	field: 'A color field type with validation on the server',
	page: 'A dashboard page that calls a route of the plugin',
	'auth-provider': 'A sign-in provider for an OpenID Connect provider',
	empty: 'Only the manifest and an icon'
};

export function isTemplate(value: string): value is PluginTemplate {
	return (TEMPLATES as readonly string[]).includes(value);
}

/** `vitest.config.ts`: imports of `.svelte` and `.svg` files are `PluginFile`s, as in a build. */
const VITEST_CONFIG = `import { pouchbasePlugin } from '@pouchbasejs/plugin-sdk/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({ plugins: [pouchbasePlugin()] });
`;

/** Path of the plugin's own icon in new projects. */
const PLUGIN_ICON_PATH = 'icon.svg';

/** A placeholder for the plugin's icon in the marketplace; the author replaces it. */
const PLUGIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>
`;

/** The `@pouchbasejs/ui` versions new plugins are written against. */
const UI_PACKAGE_RANGE = '^0.2.0';

/** The Pouchbase versions new plugins need: the first with everything the templates use. */
const POUCHBASE_ENGINE_RANGE = '>=0.10.0';

/** Versions of the test and check tools in new plugins, as the repository uses them. */
const VITEST_RANGE = '^5.0.5';
const SVELTE_CHECK_RANGE = '^4.7.7';

/**
 * `compilerOptions.types` of a new plugin: `svelte` types the `.svelte` imports of `plugin.ts`, and
 * `@pouchbasejs/plugin-sdk/env` its `.svg` imports.
 */
const TSCONFIG_TYPES = ['svelte', '@pouchbasejs/plugin-sdk/env'] as const;

function readme(name: string) {
	return `# ${name}

A [Pouchbase](https://pouchbase.io) plugin. \`plugin.ts\` says what it adds, in
\`definePlugin({ ... })\`: its settings, field types, pages, sign-in providers and routes, each by
id. It imports their code, components and icons from wherever you keep them; this project starts
with:

- \`fields/<type>/\`: a field type (\`field.ts\` with \`defineField\`, \`input.svelte\`, \`preview.svelte\`);
- \`pages/<path>.svelte\`: a dashboard page, at \`/plugins/<id>/<path>\`;
- \`auth/<id>/\`: a sign-in provider (\`provider.ts\` with \`defineAuthProvider\`, \`icon.svg\`);
- \`routes/<path>.ts\`: routes at \`/api/plugins/<id>/<path>\` (\`export const GET\`, \`POST\`, …);
- \`lib/\`: code shared by the rest.

Scripts:

- \`pnpm dev\` builds the plugin on every change and serves it from a local registry; start
  Pouchbase with the \`POUCHBASE_REGISTRY_URL\` it prints and install the plugin on the Plugins page.
- \`pnpm validate\` checks the plugin and compiles its components like Pouchbase does on install;
  \`npx pouchbase-plugin manifest\` prints the manifest it generates.
- \`pnpm test\` runs the tests in \`test/\` (vitest, with \`fakeContext\` from
  \`@pouchbasejs/plugin-sdk/testing\`); \`pnpm check\` type-checks the code and the components.
- \`pnpm build\` writes the bundle to \`dist/\`.
- \`pnpm release\` publishes it to the registry (needs \`POUCHBASE_REGISTRY_TOKEN\`).
- \`npx pouchbase-plugin add field|page|auth-provider|route <id>\` creates the files of a
  contribution and adds it to \`plugin.ts\`;
  \`npx pouchbase-plugin add setting <key> [--type text|secret|number|boolean|url]\` adds a setting.

The version lives in \`package.json\`; the manifest takes it from there.
`;
}

/**
 * Every file of a new plugin. The manifest has a human `name` and no `version`: `version`,
 * `description` and `license` come from `package.json`, so a release only bumps one file.
 */
export function projectFiles(id: string, template: PluginTemplate, sdkVersion: string): Files {
	const name = title(id);
	const manifest: Record<string, unknown> = { $schema: MANIFEST_SCHEMA_URL, id, name };
	let tests: Files = { 'test/plugin.test.ts': emptyTest(id) };
	let description = 'A Pouchbase plugin.';
	let settings: SettingTemplate[] = [];
	let entries: PluginEntry[] = [];

	switch (template) {
		case 'field':
			description = 'Adds a color field type.';
			manifest.categories = ['fields'];
			entries = [colorFieldEntry()];
			tests = { 'test/color.test.ts': COLOR_TEST };
			break;

		case 'page':
			description = 'Adds a page to the dashboard.';
			manifest.categories = ['pages'];
			settings = [
				{
					key: 'greeting',
					label: 'Greeting',
					description: 'How the Hello page greets, e.g. Hello or Welcome.',
					type: 'text',
					default: 'Hello'
				}
			];
			entries = helloEntries(id);
			tests = { 'test/hello.test.ts': helloTest(id) };
			break;

		case 'auth-provider': {
			const provider = providerIdFor(id);

			manifest.name = `${title(provider)} sign-in`;
			description = `Sign in with ${title(provider)}.`;
			manifest.categories = ['auth'];
			manifest.permissions = { network: [EXAMPLE_PROVIDER_HOST] };
			entries = [providerEntry(provider, camelCase(provider))];
			tests = { 'test/provider.test.ts': providerTest(provider) };
			break;
		}

		case 'empty':
			break;
	}

	manifest.engines = { pouchbase: POUCHBASE_ENGINE_RANGE };

	return {
		[MANIFEST_FILE]: json(manifest),
		[PLUGIN_ICON_PATH]: PLUGIN_ICON,
		'package.json': json({
			name: id,
			version: '0.1.0',
			private: true,
			description,
			license: 'MIT',
			type: 'module',
			scripts: {
				dev: 'pouchbase-plugin dev',
				check: 'svelte-check --tsconfig ./tsconfig.json',
				test: 'vitest run',
				validate: 'pouchbase-plugin validate',
				build: 'pouchbase-plugin build',
				release: 'pouchbase-plugin publish'
			},
			devDependencies: {
				'@pouchbasejs/plugin-sdk': `^${sdkVersion}`,
				// Types only: the host provides the components at runtime.
				'@pouchbasejs/ui': UI_PACKAGE_RANGE,
				svelte: '^5.0.0',
				'svelte-check': SVELTE_CHECK_RANGE,
				typescript: '^6.0.0',
				vitest: VITEST_RANGE
			}
		}),
		'tsconfig.json': json({
			compilerOptions: {
				target: 'ES2022',
				module: 'ESNext',
				moduleResolution: 'Bundler',
				lib: ['ES2022', 'DOM'],
				types: TSCONFIG_TYPES,
				strict: true,
				verbatimModuleSyntax: true,
				skipLibCheck: true,
				resolveJsonModule: true,
				noEmit: true
			},
			include: ['**/*.ts', '**/*.svelte'],
			exclude: ['node_modules', 'dist']
		}),
		'vitest.config.ts': VITEST_CONFIG,
		'.gitignore': 'node_modules\ndist\n',
		'README.md': readme(name),
		[PLUGIN_FILE]: pluginFileSource(settings, entries),
		...Object.assign({}, ...entries.map((entry) => entry.files)),
		...tests
	};
}
