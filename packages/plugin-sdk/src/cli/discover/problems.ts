import { ProjectError } from '../project-error.js';

/** A problem with the plugin: where, what, and how to fix it. */
export type Problem = { path: string; message: string; hint?: string };

/** Throws a `ProjectError` for `problems`: the one problem itself, or `summary` with the list. */
export function fail(problems: Problem[], summary = 'The plugin has problems'): never {
	const hints = [...new Set(problems.flatMap((problem) => problem.hint ?? []))];
	const [first] = problems;

	if (problems.length === 1 && first) {
		throw new ProjectError(`${first.path}: ${first.message}`, [], hints[0]);
	}

	throw new ProjectError(
		summary,
		problems.map(({ path, message }) => ({ path, message })),
		hints.join(' ') || undefined
	);
}
