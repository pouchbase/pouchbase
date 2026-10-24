import type { CollectionSettings, ThumbnailSettings } from '../files/thumbnails';

import { upgradeRules } from '../filter/legacy';

/**
 * Upgrades collection settings saved before Pouchbase 0.9 to the current syntax: API rules (see
 * `upgradeFilter()`) and thumbnail sizes (`100x100t`, `100x100b` and `100x100f` became
 * `100x100:top`, `100x100:bottom` and `100x100:fit`). Settings come from the database, backups,
 * export files and snapshots of other instances, so every place that reads them runs this; it
 * leaves current settings as they are. Imported with relative paths, as `db/schema.ts` uses it.
 */

const LEGACY_SIZE = /^(\d{1,4}x\d{1,4})([tbf])$/;

const LEGACY_MODES: Record<string, string> = { t: 'top', b: 'bottom', f: 'fit' };

/** A thumbnail size in the current syntax. */
export function upgradeThumbnailSize(spec: string): string {
	const match = LEGACY_SIZE.exec(spec.trim().toLowerCase());

	return match ? `${match[1]}:${LEGACY_MODES[match[2]]}` : spec;
}

/** Thumbnail settings with every size in the current syntax. */
export function upgradeThumbnails<T extends Pick<ThumbnailSettings, 'sizes'>>(thumbnails: T): T {
	return { ...thumbnails, sizes: thumbnails.sizes.map(upgradeThumbnailSize) };
}

/** Collection settings with their rules and thumbnail sizes in the current syntax. */
export function upgradeSettings<S extends Pick<CollectionSettings, 'rules' | 'thumbnails'>>(
	settings: S
): S {
	return {
		...settings,
		...(settings.rules ? { rules: upgradeRules(settings.rules) } : {}),
		...(settings.thumbnails ? { thumbnails: upgradeThumbnails(settings.thumbnails) } : {})
	};
}
