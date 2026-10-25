import { pouchbasePlugin } from '@pouchbasejs/plugin-sdk/vite';
import { defineConfig } from 'vitest/config';

// The provider imports its logo, which is a reference to the file, as when the plugin is built.
export default defineConfig({ plugins: [pouchbasePlugin()] });
