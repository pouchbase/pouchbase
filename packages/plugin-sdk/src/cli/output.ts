import type { ManifestIssue } from '../manifest.js';

import { RegistryError } from '../registry.js';
import { ProjectError } from './project.js';

/**
 * What the CLI tells the user. Every command reports what it is doing (`step`), what it found
 * (`detail`), how it ended (`success` or an error) and what to do next (`next`), so there is always
 * feedback, also when something goes wrong halfway. Results go to stdout, warnings and errors to
 * stderr. Colors only in a terminal, and never with `NO_COLOR`.
 */

/** An error the user can fix, with a hint on how; printed without a stack trace. */
export class CliError extends Error {
	override name = 'CliError';

	constructor(
		message: string,
		readonly hint?: string
	) {
		super(message);
	}
}

/** Errors that come from the user's input or project, not from a bug: no stack trace needed. */
function isExpected(error: Error) {
	return (
		error instanceof CliError || error instanceof ProjectError || error instanceof RegistryError
	);
}

/** A writable stream, such as `process.stdout`. */
type Stream = { write(text: string): unknown; isTTY?: boolean };

export type LoggerOptions = {
	/** Only results, warnings and errors: no steps or details. */
	quiet?: boolean;
	/** Also stack traces, causes and every request of the dev registry. */
	verbose?: boolean;
	stdout?: Stream;
	stderr?: Stream;
	/** Defaults to on in a terminal, unless `NO_COLOR` is set or `FORCE_COLOR` turns it on. */
	color?: boolean;
};

export type Logger = {
	readonly verbose: boolean;
	/** Something the command starts doing, e.g. `Reading pouchbase-plugin.json`. */
	step(message: string): void;
	/** A detail of the last step or result, indented. */
	detail(message: string): void;
	/** A detail only shown with `--verbose`. */
	debug(message: string): void;
	/** The result of a command or step. */
	success(message: string): void;
	/** What the user can do next. */
	next(message: string): void;
	/** Problems that don't stop the command. */
	warnings(warnings: readonly ManifestIssue[]): void;
	warn(message: string): void;
	/** An error, with its issues and a hint on how to fix it. */
	error(error: unknown): void;
};

const CODES = { dim: 2, red: 31, green: 32, yellow: 33, cyan: 36, bold: 1 } as const;

type Paint = (style: keyof typeof CODES, text: string) => string;

function colorEnabled(stream: Stream, option: boolean | undefined) {
	if (option !== undefined) {
		return option;
	}

	if (process.env.NO_COLOR) {
		return false;
	}

	return !!process.env.FORCE_COLOR || !!stream.isTTY;
}

/** How to fix a registry error, when there is something the user can do. */
function registryHint(error: RegistryError): string | null {
	switch (error.status) {
		case 0:
			return 'Check your connection and the registry URL (--registry or $POUCHBASE_REGISTRY_URL).';
		case 401:
			return 'Pass a valid publish token with --token or $POUCHBASE_REGISTRY_TOKEN.';
		case 403:
			return 'The token belongs to an account that may not publish this plugin.';
		case 404:
			return 'Check the registry URL (--registry or $POUCHBASE_REGISTRY_URL).';
		case 409:
			return 'Every version can be published once: raise "version" in package.json (or pouchbase-plugin.json) and publish again.';
		case 413:
			return 'Make the bundle smaller, e.g. by moving large assets out of ui/.';
		default:
			return error.status >= 500 ? 'The registry had a problem; try again in a moment.' : null;
	}
}

export function createLogger(options: LoggerOptions = {}): Logger {
	const stdout = options.stdout ?? process.stdout;
	const stderr = options.stderr ?? process.stderr;
	const quiet = options.quiet ?? false;
	const verbose = options.verbose ?? false;
	const painter =
		(stream: Stream): Paint =>
		(style, text) =>
			colorEnabled(stream, options.color) ? `\x1b[${CODES[style]}m${text}\x1b[0m` : text;
	const out = painter(stdout);
	const err = painter(stderr);
	const print = (stream: Stream, line: string) => stream.write(`${line}\n`);
	const issueLine = (issue: ManifestIssue) =>
		`${issue.path ? `${issue.path}: ` : ''}${issue.message}`;

	const logger: Logger = {
		verbose,

		step(message) {
			if (!quiet) {
				print(stdout, `${out('cyan', '›')} ${message}`);
			}
		},

		detail(message) {
			if (!quiet) {
				print(stdout, out('dim', `  ${message}`));
			}
		},

		debug(message) {
			if (verbose) {
				print(stdout, out('dim', `  ${message}`));
			}
		},

		success(message) {
			print(stdout, `${out('green', '✓')} ${message}`);
		},

		next(message) {
			if (!quiet) {
				print(stdout, `  ${out('bold', 'Next:')} ${message}`);
			}
		},

		warnings(warnings) {
			for (const warning of warnings) {
				logger.warn(issueLine(warning));
			}
		},

		warn(message) {
			print(stderr, `${err('yellow', '!')} ${message}`);
		},

		error(error) {
			if (!(error instanceof Error)) {
				print(stderr, `${err('red', '✗')} ${String(error)}`);
				return;
			}

			print(stderr, `${err('red', '✗')} ${error.message}`);

			if (error instanceof ProjectError || error instanceof RegistryError) {
				for (const issue of error.issues) {
					print(stderr, `  ${issueLine(issue)}`);
				}
			}

			const hint =
				error instanceof CliError || error instanceof ProjectError
					? error.hint
					: error instanceof RegistryError
						? registryHint(error)
						: null;

			if (hint) {
				print(stderr, `  ${err('bold', 'Hint:')} ${hint}`);
			}

			if (verbose && error.stack && !isExpected(error)) {
				print(stderr, err('dim', error.stack));
			}

			if (verbose && error.cause) {
				print(stderr, err('dim', `Caused by: ${String(error.cause)}`));
			}

			if (!verbose && !isExpected(error)) {
				print(stderr, err('dim', '  Run again with --verbose for the stack trace.'));
			}
		}
	};

	return logger;
}
