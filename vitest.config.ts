import { defineConfig } from 'vitest/config';

import { embeddedPlugins } from './vite/embedded-plugins.ts';
import { functionWorker } from './vite/function-worker.ts';
import { pluginWorker } from './vite/plugin-worker.ts';

// Unit tests of pure modules (no SvelteKit runtime); `#lib/*` resolves through package.json imports.
export default defineConfig({
	// The built-in plugins (`virtual:pouchbase/embedded-plugins`) and the bundled entries of plugin
	// and function Workers, as in the app.
	plugins: [embeddedPlugins(), pluginWorker(), functionWorker()],
	test: {
		include: ['src/**/*.test.ts']
	}
});
