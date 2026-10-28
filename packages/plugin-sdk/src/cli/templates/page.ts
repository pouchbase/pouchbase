import type { PluginEntry } from './entries.js';

/** The `page` template: a dashboard page that calls a route of the plugin, with a setting. */

/** The `page` template: a page that shows what its `GET /hello` route returns. */
export function helloEntries(pluginId: string): PluginEntry[] {
	return [
		{
			key: 'pages',
			id: 'hello',
			value: `{\n\ttitle: 'Hello',\n\ticon: 'lucide:hand',\n\tcomponent: Hello\n}`,
			imports: [`import Hello from './pages/hello.svelte';`],
			files: {
				'pages/hello.svelte': `<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Button from '@pouchbasejs/ui/button';

	let { api }: PageProps = $props();

	async function hello() {
		const response = await api.fetch('/hello');

		if (!response.ok) {
			throw new Error(\`The route answered \${response.status}\`);
		}

		const body = (await response.json()) as { message: string };

		return body.message;
	}

	let message = $state(hello());
</script>

<h1>Hello</h1>

{#await message}
	<p>Loading…</p>
{:then text}
	<p>{text}</p>
{:catch error}
	<p>{error.message}</p>
{/await}

<!-- Components from @pouchbasejs/ui look like the rest of the dashboard. -->
<Button.Root variant="secondary" onclick={() => (message = hello())}>Ask again</Button.Root>
`
			}
		},
		{
			key: 'routes',
			id: '/hello',
			value: 'hello',
			imports: [`import * as hello from './routes/hello.js';`],
			files: {
				'routes/hello.ts': `import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * Served at /api/plugins/${pluginId}/hello; the page calls it with api.fetch('/hello'). The greeting
 * is a setting from plugin.ts, typed: a key it doesn't have is a type error.
 */
export const GET: RouteHandler = async (_request, ctx) => {
	const greeting = await ctx.settings.get('greeting');

	return Response.json({ message: \`\${greeting} from \${ctx.plugin.id} \${ctx.plugin.version}\` });
};
`
			}
		}
	];
}

/** The test of the `page` template: its route, with the greeting setting. */
export function helloTest(pluginId: string) {
	return `import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import plugin from '../plugin.js';
import manifest from '../pouchbase-plugin.json' with { type: 'json' };

const request = new Request('https://pouchbase.test/api/plugins/${pluginId}/hello');
const { GET } = plugin.routes['/hello'];

describe('GET /hello', () => {
	it('greets with the default greeting', async () => {
		const { ctx } = fakeContext({ manifest, plugin });
		const response = await GET(request, ctx);

		expect(await response.json()).toEqual({ message: 'Hello from ${pluginId} 0.1.0' });
	});

	it('greets with the greeting an admin saved', async () => {
		// Settings are the strings the host stores, typed by the keys in plugin.ts.
		const { ctx } = fakeContext({ manifest, plugin, settings: { greeting: 'Welcome' } });
		const response = await GET(request, ctx);

		expect(await response.json()).toEqual({ message: 'Welcome from ${pluginId} 0.1.0' });
	});
});
`;
}
