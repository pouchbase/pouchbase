import { defineConfig } from 'vitest/config';

import { embeddedPlugins } from './vite/embedded-plugins.ts';
import { pluginWorker } from './vite/plugin-worker.ts';

// Unit tests of pure modules (no SvelteKit runtime); `#lib/*` resolves through package.json imports.
export default defineConfig({
	// The built-in plugins (`virtual:pouchbase/embedded-plugins`) and the JS SDK for plugin Workers
	// (`virtual:pouchbase/js-sdk-module`), as in the app.
	plugins: [embeddedPlugins(), pluginWorker()],
	test: {
		include: ['src/**/*.test.ts']
	}
});
