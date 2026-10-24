import type { PluginBundle } from '../bundle.js';
import type {
	PluginDetails,
	PluginList,
	PluginSummary,
	PluginVersion,
	RegistryErrorBody
} from '../registry.js';

import { watch } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';

import { computeIntegrity, serializeBundle } from '../bundle.js';
import { effectiveCategories } from '../categories.js';
import { REGISTRY_API_PREFIX } from '../registry.js';
import { count, elapsed, kib } from './format.js';
import { CliError, createLogger, type Logger } from './output.js';
import { buildBundle } from './project.js';

/**
 * A local registry that serves the plugin being developed, so a Pouchbase started with
 * `POUCHBASE_REGISTRY_URL=http://localhost:<port>` can find and install it. Rebuilds on every change;
 * when a build fails, the last good one stays available.
 *
 * Every build is served as a new prerelease, `<version>-dev.<n>`, so Pouchbase sees it as an
 * update of the one it installed; `exactVersion` serves the version from the manifest instead.
 */

type Build = { bundle: PluginBundle; bytes: Uint8Array<ArrayBuffer>; integrity: string; at: Date };

const IGNORED = /(?:^|[\\/])(?:node_modules|dist|\.git)(?:[\\/]|$)/;

/** The bundle with its version turned into `<version>-dev.<n>`; `1.0.0-beta.1` → `1.0.0-beta.1-dev.<n>`. */
export function withDevVersion(
	bundle: PluginBundle,
	n: number
): { bundle: PluginBundle; bytes: Uint8Array<ArrayBuffer> } {
	const dev = {
		...bundle,
		manifest: { ...bundle.manifest, version: `${bundle.manifest.version}-dev.${n}` }
	};

	return { bundle: dev, bytes: serializeBundle(dev) };
}

export async function startDevServer(
	root: string,
	port: number,
	{ exactVersion = false, log = createLogger() }: { exactVersion?: boolean; log?: Logger } = {}
) {
	const base = `http://localhost:${port}`;
	let current: Build | null = null;
	let builds = 0;

	async function rebuild(reason?: string) {
		const start = performance.now();

		log.step(reason ? `${reason}, rebuilding` : 'Building the plugin');

		try {
			// The steps of the first build are shown; those of later ones only with --verbose.
			const built = await buildBundle(root, { log: builds === 0 || log.verbose ? log : undefined });

			log.warnings(built.warnings);

			const { bundle, bytes } = exactVersion ? built : withDevVersion(built.bundle, builds + 1);

			builds += 1;
			current = { bundle, bytes, integrity: await computeIntegrity(bytes), at: new Date() };
			log.success(
				`Built ${bundle.manifest.id}@${bundle.manifest.version} in ${elapsed(start)} (${kib(bytes.byteLength)})`
			);

			if (builds > 1) {
				log.detail('Update the plugin on the Plugins page of Pouchbase to try this build.');
			}
		} catch (error) {
			log.error(error);
			log.detail(
				current
					? `Still serving ${current.bundle.manifest.id}@${current.bundle.manifest.version}; fix the problem and save to rebuild.`
					: 'Nothing to serve yet; fix the problem and save to rebuild.'
			);
		}
	}

	function version(build: Build): PluginVersion {
		const { manifest } = build.bundle;

		return {
			version: manifest.version,
			apiVersion: manifest.apiVersion,
			integrity: build.integrity,
			size: build.bytes.byteLength,
			bundleUrl: `${base}${REGISTRY_API_PREFIX}/plugins/${manifest.id}/versions/${manifest.version}/bundle`,
			pouchbase: manifest.engines.pouchbase ?? null,
			permissions: manifest.permissions,
			publishedAt: build.at.toISOString()
		};
	}

	function summary(build: Build): PluginSummary {
		const { manifest } = build.bundle;

		return {
			id: manifest.id,
			name: manifest.name,
			description: manifest.description,
			version: manifest.version,
			apiVersion: manifest.apiVersion,
			author: manifest.author?.name ?? null,
			iconUrl: manifest.icon
				? `${base}${REGISTRY_API_PREFIX}/plugins/${manifest.id}/icon?v=${build.at.getTime()}`
				: null,
			keywords: manifest.keywords,
			categories: effectiveCategories(manifest),
			downloads: 0,
			verified: false,
			updatedAt: build.at.toISOString()
		};
	}

	function details(build: Build): PluginDetails {
		const { manifest } = build.bundle;

		return {
			...summary(build),
			license: manifest.license,
			homepage: manifest.homepage ?? null,
			repository: manifest.repository ?? null,
			readme: null,
			versions: [version(build)]
		};
	}

	function send(response: ServerResponse, status: number, body: unknown) {
		response.writeHead(status, { 'Content-Type': 'application/json' });
		response.end(JSON.stringify(body));
	}

	function notFound(response: ServerResponse) {
		send(response, 404, {
			error: { code: 'not_found', message: 'Not found' }
		} satisfies RegistryErrorBody);
	}

	const server = createServer((request, response) => {
		const url = new URL(request.url ?? '/', base);

		response.on('finish', () => {
			// A download is what the user waits for; other requests are only shown with --verbose.
			if (url.pathname.endsWith('/bundle') && response.statusCode === 200 && current) {
				log.success(
					`Pouchbase downloaded ${current.bundle.manifest.id}@${current.bundle.manifest.version}`
				);
			} else {
				log.debug(`${request.method} ${url.pathname}${url.search} → ${response.statusCode}`);
			}
		});

		const parts = url.pathname.replace(REGISTRY_API_PREFIX, '').split('/').filter(Boolean);
		const build = current;

		if (request.method !== 'GET') {
			send(response, 405, {
				error: { code: 'method_not_allowed', message: 'The dev registry is read-only' }
			} satisfies RegistryErrorBody);
			return;
		}

		if (!url.pathname.startsWith(REGISTRY_API_PREFIX) || parts[0] !== 'plugins') {
			notFound(response);
			return;
		}

		const found = build && (!parts[1] || parts[1] === build.bundle.manifest.id) ? build : null;

		if (parts.length === 1) {
			const query = url.searchParams.get('q')?.toLowerCase() ?? '';
			const category = url.searchParams.get('category');
			const items =
				build &&
				`${build.bundle.manifest.id} ${build.bundle.manifest.name}`.toLowerCase().includes(query) &&
				(!category || effectiveCategories(build.bundle.manifest).includes(category))
					? [summary(build)]
					: [];

			send(response, 200, {
				items,
				page: 1,
				perPage: 20,
				total: items.length
			} satisfies PluginList);
			return;
		}

		if (!found) {
			notFound(response);
			return;
		}

		const { manifest } = found.bundle;

		if (parts.length === 2) {
			send(response, 200, details(found));
			return;
		}

		const icon = manifest.icon ? found.bundle.files[manifest.icon] : undefined;

		if (parts.length === 3 && parts[2] === 'icon' && icon !== undefined) {
			response.writeHead(200, {
				'Content-Type': 'image/svg+xml',
				'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
				'X-Content-Type-Options': 'nosniff'
			});
			response.end(icon);
			return;
		}

		const matches =
			parts[2] === 'versions' && (parts[3] === 'latest' || parts[3] === manifest.version);

		if (matches && parts.length === 4) {
			send(response, 200, version(found));
			return;
		}

		if (matches && parts.length === 5 && parts[4] === 'bundle') {
			response.writeHead(200, { 'Content-Type': 'application/json' });
			response.end(found.bytes);
			return;
		}

		notFound(response);
	});

	// The port first, so a port in use is reported before building.
	await new Promise<void>((resolve, reject) => {
		server.once('error', (error: NodeJS.ErrnoException) =>
			reject(
				error.code === 'EADDRINUSE'
					? new CliError(`Port ${port} is already in use`, 'Pass another port with --port.')
					: error
			)
		);
		server.listen(port, resolve);
	});

	await rebuild();

	let timer: ReturnType<typeof setTimeout> | undefined;

	// Files changed since the last rebuild, to say what triggered it.
	let changed = new Set<string>();

	watch(root, { recursive: true }, (_event, file) => {
		if (file && IGNORED.test(file)) {
			return;
		}

		if (file) {
			changed.add(file.split('\\').join('/'));
		}

		clearTimeout(timer);
		timer = setTimeout(() => {
			const files = [...changed];

			changed = new Set();
			void rebuild(
				files.length === 1
					? `${files[0]} changed`
					: `${files.length ? count(files.length, 'file') : 'Files'} changed`
			);
		}, 100);
	});

	log.success(`Dev registry on ${base}`);
	log.detail(`Watching ${root} for changes (node_modules, dist and .git are ignored)`);
	log.detail(
		exactVersion
			? 'Serving the version from the manifest.'
			: 'Every build is served as <version>-dev.<n>; --exact-version serves the version as is.'
	);
	log.next(
		`start Pouchbase with POUCHBASE_REGISTRY_URL=${base} and install the plugin from the Plugins page. Press Ctrl+C to stop.`
	);
}
