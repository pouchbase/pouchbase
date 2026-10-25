#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';

import { computeIntegrity } from '../bundle.js';
import { manifestJsonSchema } from '../manifest.js';
import { DEFAULT_REGISTRY_URL, createRegistryClient } from '../registry.js';
import { CONTRIBUTION_KINDS, addContribution, isContributionKind } from './add.js';
import { startDevServer } from './dev-server.js';
import { elapsed, kib } from './format.js';
import { askTemplate, initProject, parseTemplate } from './init.js';
import { printManifest } from './manifest-command.js';
import { CliError, createLogger, type Logger } from './output.js';
import { buildBundle, bundleFileName } from './project.js';
import { TEMPLATES } from './templates.js';

const HELP = `Usage: pouchbase-plugin <command> [options]

Commands:
  init <dir>             Create a plugin in a new directory; its name becomes the plugin id
  add <kind> <id>        Add a field, page, auth-provider or route: its files and its entry in
                         plugin.ts; or a setting (add setting <key>)
  validate               Check the plugin: plugin.ts, pouchbase-plugin.json and the components
  manifest               Print the manifest the plugin builds into, as JSON
  build                  Build the bundle into dist/
  dev                    Rebuild on every change and serve the plugin from a local registry
  publish                Build and publish the bundle to the registry
  schema                 Print the JSON Schema of pouchbase-plugin.json

Options:
  --template <name>  Template for init: ${TEMPLATES.join(', ')} (asks in a terminal; default field)
  --type <type>      Type for add setting: text, secret, number, boolean or url (default text)
  --port <n>         Port of the dev registry (default 4510)
  --exact-version    Let dev serve the manifest's version instead of <version>-dev.<n>
  --registry <url>   Registry to publish to (default $POUCHBASE_REGISTRY_URL or ${DEFAULT_REGISTRY_URL})
  --token <token>    Publish token (default $POUCHBASE_REGISTRY_TOKEN)
  -q, --quiet        Only print results, warnings and errors
  -v, --verbose      Also print stack traces and every request of the dev registry
  -h, --help         Show this help
`;

/** The package manager that runs the CLI (`pnpm dlx`, `npx`, ...), for the commands it suggests. */
function packageManager() {
	const agent = process.env.npm_config_user_agent ?? '';

	return ['pnpm', 'yarn', 'bun'].find((name) => agent.startsWith(name)) ?? 'npm';
}

/** How to run a script of the plugin's `package.json` with the package manager in use. */
function runScript(script: string) {
	const pm = packageManager();

	return pm === 'npm' ? `npm run ${script}` : `${pm} ${script}`;
}

/** The registry to publish to, and where that setting comes from, so the user sees which is used. */
function registrySource(flag: string | undefined) {
	if (flag) {
		return { url: flag, from: 'from --registry' };
	}

	if (process.env.POUCHBASE_REGISTRY_URL) {
		return { url: process.env.POUCHBASE_REGISTRY_URL, from: 'from $POUCHBASE_REGISTRY_URL' };
	}

	return { url: DEFAULT_REGISTRY_URL, from: 'the default' };
}

async function publish(
	root: string,
	log: Logger,
	options: { registry?: string; token?: string }
): Promise<void> {
	const start = performance.now();
	const registry = registrySource(options.registry);
	const token = options.token ?? process.env.POUCHBASE_REGISTRY_TOKEN;

	// Checked before building, so a missing token doesn't come up only at the end.
	if (!token) {
		throw new CliError(
			'A publish token is needed to publish',
			'Pass it with --token or set $POUCHBASE_REGISTRY_TOKEN; create one under Publish tokens on https://pouchbase.io/account.'
		);
	}

	log.step(`Publishing to ${registry.url} (${registry.from})`);
	log.detail(`Token ${options.token ? 'from --token' : 'from $POUCHBASE_REGISTRY_TOKEN'}`);

	const { bundle, bytes, warnings } = await buildBundle(root, { log });
	const { id, version } = bundle.manifest;
	const client = createRegistryClient({ url: registry.url, token });

	log.warnings(warnings);
	log.step(`Looking up ${id} on the registry`);

	const existing = await client.get(id);

	if (!existing) {
		log.detail(`${id} isn't on the registry yet; this publishes its first version`);
	} else {
		log.detail(
			`Latest published version: ${existing.version} (${existing.versions.length} in total)`
		);

		if (existing.versions.some((published) => published.version === version)) {
			throw new CliError(
				`${id}@${version} is already published`,
				'Every version can be published once: raise "version" in package.json (or pouchbase-plugin.json) and publish again.'
			);
		}
	}

	log.step(`Uploading ${id}@${version} (${kib(bytes.byteLength)})`);

	const published = await client.publish(id, bytes);

	log.success(`Published ${id}@${published.version} in ${elapsed(start)}`);
	log.detail(`API version ${published.apiVersion}, ${published.integrity}`);
	log.next(`install or update ${id} from the Plugins page of Pouchbase.`);
}

type Values = Record<string, string | boolean | undefined>;

async function main(log: Logger, positionals: string[], values: Values) {
	const [command, target, name] = positionals;
	const root = process.cwd();
	const start = performance.now();

	if (values.help || !command) {
		console.log(HELP);
		return;
	}

	switch (command) {
		case 'init': {
			if (!target) {
				throw new CliError(
					'Missing the directory for the plugin',
					'Usage: pouchbase-plugin init <dir> [--template <name>], e.g. init color-picker'
				);
			}

			// Check the flag before asking anything.
			const template =
				typeof values.template === 'string' ? parseTemplate(values.template) : await askTemplate();

			log.step(`Creating a plugin from the ${template} template`);

			const { root: created, id, files } = await initProject(target, { template });
			const dir = relative(root, created) || '.';

			for (const file of files) {
				log.detail(`Created ${file}`);
			}

			log.success(`Created ${id} in ${dir} (${template} template)`);

			const install = packageManager() === 'yarn' ? 'yarn' : `${packageManager()} install`;

			log.next(
				`${dir === '.' ? '' : `cd ${dir}, `}run ${install}, then ${runScript('dev')} to try it in Pouchbase.`
			);
			break;
		}

		case 'add': {
			if (!target || !name || !isContributionKind(target)) {
				throw new CliError(
					target && !isContributionKind(target)
						? `Unknown kind "${target}"`
						: 'Missing what to add',
					`Usage: pouchbase-plugin add <${CONTRIBUTION_KINDS.join('|')}> <id>, e.g. add field rating`
				);
			}

			log.step(`Adding ${target} ${name}`);

			const { created, changed, hints, manifestChanged } = await addContribution(
				root,
				target,
				name,
				{ type: typeof values.type === 'string' ? values.type : undefined }
			);

			if (manifestChanged) {
				log.detail('Updated pouchbase-plugin.json');
			}

			for (const file of changed ?? []) {
				log.detail(`Updated ${file}`);
			}

			for (const file of created) {
				log.detail(`Created ${file}`);
			}

			log.success(`Added ${target} ${name}`);

			for (const hint of hints) {
				log.next(hint);
			}

			if (!hints.length) {
				log.next(`run ${runScript('validate')} to check the plugin.`);
			}

			break;
		}

		case 'validate': {
			const { bundle, warnings } = await buildBundle(root, { log });

			log.warnings(warnings);
			log.success(
				`${bundle.manifest.id}@${bundle.manifest.version} is valid${warnings.length ? `, with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''} (${elapsed(start)})`
			);
			break;
		}

		case 'build': {
			const { bundle, bytes, warnings } = await buildBundle(root, { log });
			const file = join(root, 'dist', bundleFileName(bundle.manifest));

			log.warnings(warnings);
			log.step(`Writing ${relative(root, file)}`);
			await mkdir(join(root, 'dist'), { recursive: true });
			await writeFile(file, bytes);
			log.success(`Built ${relative(root, file)} (${kib(bytes.byteLength)}) in ${elapsed(start)}`);
			log.detail(await computeIntegrity(bytes));
			log.next(`publish it with ${runScript('release')}, or try it with ${runScript('dev')}.`);
			break;
		}

		case 'dev': {
			const port = Number(values.port ?? 4510);

			if (!Number.isInteger(port) || port < 1 || port > 65535) {
				throw new CliError(`Invalid port "${values.port}"`, 'Pass a number from 1 to 65535.');
			}

			await startDevServer(root, port, {
				exactVersion: values['exact-version'] === true,
				log
			});
			break;
		}

		case 'publish':
			await publish(root, log, {
				registry: typeof values.registry === 'string' ? values.registry : undefined,
				token: typeof values.token === 'string' ? values.token : undefined
			});
			break;

		case 'manifest':
			// Feedback goes to stderr, so stdout holds only the JSON.
			await printManifest(root, {
				log: createLogger({
					quiet: values.quiet === true,
					verbose: values.verbose === true,
					stdout: process.stderr
				}),
				write: (text) => process.stdout.write(text)
			});
			break;

		case 'schema':
			console.log(JSON.stringify(manifestJsonSchema(), null, '\t'));
			break;

		default:
			throw new CliError(
				`Unknown command "${command}"`,
				'Run pouchbase-plugin --help for the commands.'
			);
	}
}

let log = createLogger();

try {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: {
			template: { type: 'string' },
			type: { type: 'string' },
			port: { type: 'string' },
			'exact-version': { type: 'boolean' },
			registry: { type: 'string' },
			token: { type: 'string' },
			quiet: { type: 'boolean', short: 'q' },
			verbose: { type: 'boolean', short: 'v' },
			help: { type: 'boolean', short: 'h' }
		}
	});

	log = createLogger({ quiet: values.quiet, verbose: values.verbose });
	await main(log, positionals, values);
} catch (error) {
	log.error(
		error instanceof TypeError && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS')
			? new CliError(error.message, 'Run pouchbase-plugin --help for the options.')
			: error
	);
	process.exitCode = 1;
}
