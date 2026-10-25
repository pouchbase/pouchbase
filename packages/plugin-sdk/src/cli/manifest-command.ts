import type { PluginManifest } from '../manifest.js';
import type { Logger } from './output.js';

import { buildBundle } from './project.js';
import { json } from './templates.js';

/**
 * `pouchbase-plugin manifest`: builds the plugin like `validate` and prints the manifest it
 * generates, as hosts and the registry see it, as tab-indented JSON. Only the JSON goes to
 * `write` (stdout), so `pouchbase-plugin manifest > manifest.json` works; pass a logger that
 * writes its feedback to stderr.
 */
export async function printManifest(
	root: string,
	{ log, write }: { log?: Logger; write: (text: string) => void }
): Promise<PluginManifest> {
	const { bundle, warnings, project } = await buildBundle(root, { log });

	log?.warnings(warnings);
	log?.success(
		`Generated the manifest of ${bundle.manifest.id}@${bundle.manifest.version}${project.mode === 'legacy' ? ' (legacy layout)' : ''}`
	);
	write(json(bundle.manifest));

	return bundle.manifest;
}
