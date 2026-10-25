import { defineConfig } from 'vitest/config';

import { embeddedPlugins } from './vite/embedded-plugins.ts';

// Unit tests of pure modules (no SvelteKit runtime); `#lib/*` resolves through package.json imports.
export default defineConfig({
	// The built-in plugins (`virtual:pouchbase/embedded-plugins`), as in the app.
	plugins: [embeddedPlugins()],
	test: {
		include: ['src/**/*.test.ts']
	}
});
