import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		server: 'src/server.ts',
		ui: 'src/ui.ts',
		project: 'src/project.ts',
		testing: 'src/testing.ts',
		cli: 'src/cli/index.ts'
	},
	format: 'esm',
	platform: 'neutral',
	// Only the `pouchbase-plugin` command (src/cli) and `./project` use Node built-ins and rolldown.
	deps: { neverBundle: [/^node:/, /^rolldown/] },
	target: 'es2022',
	dts: true,
	sourcemap: true,
	clean: true
});
