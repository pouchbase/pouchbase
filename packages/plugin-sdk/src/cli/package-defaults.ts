/**
 * Filling the manifest from the plugin's `package.json`: the fields that `pouchbase-plugin.json`
 * may leave out (`PACKAGE_DEFAULT_KEYS`).
 */

import { PACKAGE_DEFAULT_KEYS } from '../manifest.js';

/** The fields of `package.json` that `withPackageDefaults` reads. */
export type PackageJson = {
	name?: string;
	version?: string;
	description?: string;
	license?: string;
	author?: string | { name?: string; email?: string; url?: string };
	homepage?: string;
	repository?: string | { url?: string };
	keywords?: string[];
};

/** `Jane Doe <jane@example.com> (https://example.com)`, npm's author shorthand. */
const PERSON = /^([^<(]*?)\s*(?:<([^>]*)>)?\s*(?:\(([^)]*)\))?$/;

function person(author: PackageJson['author']) {
	if (typeof author === 'string') {
		const [, name = '', email, url] = PERSON.exec(author.trim()) ?? [];

		return name ? { name, email: email || undefined, url: url || undefined } : undefined;
	}

	return author?.name ? { name: author.name, email: author.email, url: author.url } : undefined;
}

/** A browsable URL for `repository`: without `git+` and `.git`, shorthands expanded. */
function repositoryUrl(repository: PackageJson['repository']) {
	const value = (typeof repository === 'string' ? repository : repository?.url)?.trim();

	if (!value) {
		return undefined;
	}

	const shorthand = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(value);

	if (shorthand) {
		return `https://github.com/${shorthand[1]}`;
	}

	return value.replace(/^git\+/, '').replace(/\.git$/, '');
}

/**
 * Fills the manifest fields that `pouchbase-plugin.json` leaves out from the plugin's
 * `package.json`: `name`, `version`, `description`, `license`, `author`, `homepage`,
 * `repository` and `keywords`. The manifest wins; validate the result with `parseManifest`.
 */
export function withPackageDefaults(
	manifest: Record<string, unknown>,
	pkg: PackageJson
): Record<string, unknown> {
	const defaults: Record<string, unknown> = {
		name: pkg.name,
		version: pkg.version,
		description: pkg.description,
		license: pkg.license,
		author: person(pkg.author),
		homepage: pkg.homepage,
		repository: repositoryUrl(pkg.repository),
		keywords: pkg.keywords
	};
	const result = { ...manifest };

	for (const key of PACKAGE_DEFAULT_KEYS) {
		if (result[key] === undefined && defaults[key] !== undefined) {
			result[key] = defaults[key];
		}
	}

	return result;
}
