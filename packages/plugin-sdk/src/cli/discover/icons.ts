import type { Logger } from '../output.js';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { pluginFilePath } from '../../server.js';
import { svgIconIssues } from '../../svg.js';
import { iconifyBundlePath, isIconifyName, resolveIconifyIcon } from '../icons.js';
import { ProjectError } from '../project-error.js';
import type { Problem } from './problems.js';
import { uiBundlePath } from './ui-files.js';

/**
 * The icons that `plugin.ts` names: an Iconify name becomes a file of the bundle, an imported
 * .svg file is a UI file like the components. Both are checked like a host checks them; logos keep
 * their colors.
 */
export type IconResolver = {
	/** Bundle path → SVG of every icon given by Iconify name. */
	iconifyIcons: Record<string, string>;
	/** Project paths of the imported icon files. */
	iconFiles: string[];
	/**
	 * The bundle path of `value`, the icon at `where`: an Iconify name or an imported `.svg` file;
	 * `undefined` for none or after a problem. A `logo` keeps its colors.
	 */
	contributionIcon(value: unknown, where: string, logo?: boolean): Promise<string | undefined>;
};

/** Resolves the icons of `file` (`plugin.ts`) in `root`, adding what is wrong to `problems`. */
export function createIconResolver(
	root: string,
	file: string,
	problems: Problem[],
	log?: Logger
): IconResolver {
	const iconifyIcons: Record<string, string> = {};
	const iconFiles: string[] = [];

	/** An icon from a project file, checked; its bundle path, or `undefined` after a problem. */
	async function fileIcon(path: string, where: string, logo: boolean): Promise<string | undefined> {
		if (!logo) {
			const issues = svgIconIssues(await readFile(join(root, path), 'utf8'));

			if (issues.length) {
				problems.push(
					...issues.map((message) => ({
						path,
						message: `${message} (${where})`,
						hint: 'Icons are plain SVG images, drawn in one color by Pouchbase; an Iconify name (e.g. lucide:palette) gives one.'
					}))
				);

				return undefined;
			}
		}

		iconFiles.push(path);

		return uiBundlePath(path);
	}

	/**
	 * The bundle path of `value`, the icon at `where`: an Iconify name or an imported `.svg` file;
	 * `undefined` for none or after a problem. A `logo` keeps its colors.
	 */
	async function contributionIcon(
		value: unknown,
		where: string,
		logo = false
	): Promise<string | undefined> {
		if (value === undefined) {
			return undefined;
		}

		const path = pluginFilePath(value);

		if (path !== null) {
			if (!path.endsWith('.svg')) {
				problems.push({ path: file, message: `${where}: ${path} is not an .svg file` });

				return undefined;
			}

			return fileIcon(path, where, logo);
		}

		if (typeof value !== 'string' || !isIconifyName(value)) {
			problems.push({
				path: file,
				message: `${where} must be an Iconify name, e.g. lucide:palette, or an imported .svg file`,
				hint: "Import an icon of the plugin like a module: import icon from './icon.svg';"
			});

			return undefined;
		}

		try {
			const { svg, source } = await resolveIconifyIcon(root, value, { log, label: where });
			const bundlePath = iconifyBundlePath(value);

			iconifyIcons[bundlePath] = svg;
			log?.detail(`Resolved icon ${value} for ${where} (${source})`);

			return bundlePath;
		} catch (error) {
			if (!(error instanceof ProjectError)) {
				throw error;
			}

			problems.push({ path: file, message: `${where}: ${error.message}`, hint: error.hint });

			return undefined;
		}
	}

	return { iconifyIcons, iconFiles, contributionIcon };
}
