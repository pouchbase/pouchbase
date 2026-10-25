import type { Logger } from './output.js';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { svgIconIssues } from '../svg.js';
import { ProjectError } from './project-error.js';

/**
 * Icons of field types and pages given by Iconify name (`icon: 'lucide:palette'`): the CLI turns
 * them into SVG files of the bundle when it builds, so Pouchbase never fetches an icon. It looks
 * for a name in the installed icon set `@iconify-json/<prefix>`, of the plugin first and then of the
 * SDK (which comes with `lucide`, the dashboard's own set), then in its cache, and fetches it from
 * the Iconify API otherwise, once: the result is cached in `node_modules/.cache/pouchbase-plugin`.
 */

/** `lucide:palette`, `material-symbols:home-outline`: an Iconify icon name. */
export const ICONIFY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/** Where icons are fetched from when no installed icon set has them. */
export const ICONIFY_API = 'https://api.iconify.design';

/** Where fetched icons are kept, relative to the project. */
export const ICON_CACHE_DIR = join('node_modules', '.cache', 'pouchbase-plugin', 'icons');

/** How long a request to the Iconify API may take. */
const FETCH_TIMEOUT = 10_000;

/** Whether an `icon` value is an Iconify name rather than the path of a file. */
export function isIconifyName(value: string) {
	return value.includes(':') && !value.includes('/') && !value.endsWith('.svg');
}

/** The bundle path of an icon given by Iconify name: `lucide:palette` → `ui/icons/lucide/palette.svg`. */
export function iconifyBundlePath(name: string) {
	const [prefix, icon] = name.split(':');

	return `ui/icons/${prefix}/${icon}.svg`;
}

/** An icon of an Iconify JSON icon set (`@iconify-json/<prefix>/icons.json`). */
type IconData = {
	body: string;
	left?: number;
	top?: number;
	width?: number;
	height?: number;
	rotate?: number;
	hFlip?: boolean;
	vFlip?: boolean;
};

type IconSet = {
	prefix?: string;
	icons: Record<string, IconData>;
	aliases?: Record<string, Partial<IconData> & { parent: string }>;
	left?: number;
	top?: number;
	width?: number;
	height?: number;
};

function number(value: number | undefined, fallback: number) {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The SVG of `name` in an Iconify JSON icon set, or `null` when the set doesn't have it. */
export function iconSetSvg(set: IconSet, name: string): string | null {
	const chain: (Partial<IconData> & { parent?: string })[] = [];
	let current = name;

	// An alias points to an icon or another alias, and may add a flip or a rotation.
	for (let depth = 0; depth < 8; depth += 1) {
		const icon = Object.hasOwn(set.icons, current) ? set.icons[current] : undefined;

		if (icon) {
			chain.push(icon);
			break;
		}

		const alias =
			set.aliases && Object.hasOwn(set.aliases, current) ? set.aliases[current] : undefined;

		if (!alias) {
			return null;
		}

		chain.push(alias);
		current = alias.parent;
	}

	const base = chain.at(-1);

	if (!base || typeof base.body !== 'string') {
		return null;
	}

	// The nearest alias wins for the box; flips and rotations add up.
	const pick = (key: 'left' | 'top' | 'width' | 'height') =>
		chain.find((item) => typeof item[key] === 'number')?.[key];
	const left = number(pick('left'), number(set.left, 0));
	const top = number(pick('top'), number(set.top, 0));
	const width = number(pick('width'), number(set.width, 16));
	const height = number(pick('height'), number(set.height, 16));
	const hFlip = chain.filter((item) => item.hFlip).length % 2 === 1;
	const vFlip = chain.filter((item) => item.vFlip).length % 2 === 1;
	const rotate = chain.reduce((sum, item) => sum + number(item.rotate, 0), 0) % 4;
	const cx = left + width / 2;
	const cy = top + height / 2;
	const transforms: string[] = [];

	if (rotate) {
		transforms.push(`rotate(${rotate * 90} ${cx} ${cy})`);
	}

	if (hFlip || vFlip) {
		transforms.push(
			`translate(${cx} ${cy}) scale(${hFlip ? -1 : 1} ${vFlip ? -1 : 1}) translate(${-cx} ${-cy})`
		);
	}

	const turned = rotate % 2 === 1;
	const box = turned
		? [cx - height / 2, cy - width / 2, height, width]
		: [left, top, width, height];
	const body = transforms.length
		? `<g transform="${transforms.join(' ')}">${base.body}</g>`
		: base.body;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="${box.join(' ')}">${body}</svg>`;
}

/** The `icons.json` of `@iconify-json/<prefix>`, of the plugin or else of the SDK; `null` without. */
async function installedIconSet(
	root: string,
	prefix: string
): Promise<{ set: IconSet; from: string } | null> {
	const specifier = `@iconify-json/${prefix}/icons.json`;

	for (const [base, from] of [
		[join(root, 'package.json'), 'the plugin'],
		[import.meta.url, '@pouchbasejs/plugin-sdk']
	] as const) {
		let file: string;

		try {
			file = createRequire(base).resolve(specifier);
		} catch {
			continue;
		}

		try {
			return { set: JSON.parse(await readFile(file, 'utf8')) as IconSet, from };
		} catch {
			continue;
		}
	}

	return null;
}

export type ResolvedIcon = {
	svg: string;
	/** Where it came from, for the log: `@iconify-json/lucide (of the plugin)`, `the cache`, ... */
	source: string;
};

export type ResolveIconOptions = {
	log?: Logger;
	/** For the log: what the icon is for, e.g. `field color`. */
	label: string;
};

/** Icon sets read during this process, by project and prefix. */
const sets = new Map<string, Promise<{ set: IconSet; from: string } | null>>();

/**
 * The SVG of an Iconify icon (`lucide:palette`) for a plugin in `root`: from an installed icon set,
 * the cache, or the Iconify API. Throws a `ProjectError` with a hint when it can't be found.
 */
export async function resolveIconifyIcon(
	root: string,
	name: string,
	{ log, label }: ResolveIconOptions
): Promise<ResolvedIcon> {
	if (!ICONIFY_NAME.test(name)) {
		throw new ProjectError(
			`icon "${name}" is not an Iconify name`,
			[],
			'Use prefix:name in lowercase, e.g. lucide:palette (see https://icon-sets.iconify.design), or the path of an .svg file.'
		);
	}

	const [prefix = '', icon = ''] = name.split(':');
	const key = `${root}\0${prefix}`;
	let installed = sets.get(key);

	if (!installed) {
		installed = installedIconSet(root, prefix);
		sets.set(key, installed);
	}

	const found = await installed;

	// Not remembered, so an icon set installed while `pouchbase-plugin dev` runs is found.
	if (!found) {
		sets.delete(key);
	}

	if (found) {
		const svg = iconSetSvg(found.set, icon);

		if (svg) {
			return { svg, source: `@iconify-json/${prefix} of ${found.from}` };
		}

		log?.debug(`@iconify-json/${prefix} of ${found.from} has no icon ${icon}`);
	}

	const cached = join(root, ICON_CACHE_DIR, prefix, `${icon}.svg`);
	const hit = await readFile(cached, 'utf8').catch(() => null);

	if (hit !== null && !svgIconIssues(hit).length) {
		return { svg: hit, source: 'the icon cache' };
	}

	const url = `${ICONIFY_API}/${prefix}/${icon}.svg`;
	const hint = `Install the icon set (pnpm add -D @iconify-json/${prefix}) or add an .svg file and use its path.`;

	log?.step(`Fetching icon ${name} for ${label} from ${url}`);

	let response: Response;

	try {
		response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
	} catch (error) {
		throw new ProjectError(
			`can't fetch icon ${name} from ${ICONIFY_API}: ${(error as Error).message}`,
			[],
			hint
		);
	}

	const svg = response.ok ? (await response.text()).trim() : '';

	if (!response.ok || !svg.startsWith('<svg')) {
		throw new ProjectError(
			`icon ${name} doesn't exist${found ? '' : ` (${ICONIFY_API} answered ${response.status})`}`,
			[],
			`Look the name up on https://icon-sets.iconify.design. ${hint}`
		);
	}

	const issues = svgIconIssues(svg);

	if (issues.length) {
		throw new ProjectError(`icon ${name} ${issues[0]}`, [], hint);
	}

	try {
		await mkdir(dirname(cached), { recursive: true });
		await writeFile(cached, svg);
	} catch (error) {
		log?.debug(`Could not cache icon ${name}: ${(error as Error).message}`);
	}

	return { svg, source: ICONIFY_API };
}
