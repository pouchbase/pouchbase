import type { ManifestIssue } from '../manifest.js';

/** A problem with a plugin project on disk, with the files it concerns and how to fix it. */
export class ProjectError extends Error {
	override name = 'ProjectError';

	constructor(
		message: string,
		readonly issues: ManifestIssue[] = [],
		/** How to fix it, when there is something the user can do. */
		readonly hint?: string
	) {
		super(message);
	}
}
