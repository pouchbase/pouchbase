import { defineConfig } from 'vitest/config';

import { embeddedPlugins } from './vite/embedded-plugins.ts';
import { jsSdkModule } from './vite/js-sdk-module.ts';

// Unit tests of pure modules (no SvelteKit runtime); `#lib/*` resolves through package.json imports.
export default defineConfig({
	// The built-in plugins (`virtual:pouchbase/embedded-plugins`) and the JS SDK for plugin Workers
	// (`virtual:pouchbase/js-sdk-module`), as in the app.
	plugins: [embeddedPlugins(), jsSdkModule()],
	test: {
		include: ['src/**/*.test.ts']
	}
});
