import { pouchbasePlugin } from '@pouchbasejs/plugin-sdk/vite';
import { defineConfig } from 'vitest/config';

// Imports of .svelte and .svg files are references to the files, as when the plugin is built.
export default defineConfig({ plugins: [pouchbasePlugin()] });
