import type { PluginManifestInput } from '../src/manifest.js';

import { API_VERSION } from '../src/index.js';

/** A valid manifest with one field type, as a plugin author writes it. */
export const valid: PluginManifestInput = {
	apiVersion: API_VERSION,
	id: 'color-picker',
	name: 'Color picker',
	version: '1.0.0',
	description: 'Adds a color field type.',
	license: 'MIT',
	server: 'server/index.ts',
	contributes: {
		fields: [
			{
				type: 'color',
				label: 'Color',
				description: 'A hex color.',
				column: 'TEXT',
				input: 'ui/color-input.svelte'
			}
		]
	}
};
