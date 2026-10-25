import type { ApiRuleAction } from '#lib/filter/rules.js';

/** What a plugin may do through the records API; `requestAccess` and `RecordsService.guard` use it. */

/**
 * What a plugin may do through the records API (`ctx.pouch`): the collections it may read (list
 * and view) and write (create, update and delete), by name, or `'*'` for all. Its own
 * collections are in both. API rules don't apply to it.
 */
export type PluginGrant = {
	pluginId: string;
	read: '*' | ReadonlySet<string>;
	write: '*' | ReadonlySet<string>;
};

/** Whether `grant` allows `action` on the collection `name`; `write` includes `read`. */
export function pluginMay(grant: PluginGrant, action: ApiRuleAction, name: string) {
	const allows = (names: PluginGrant['read']) => names === '*' || names.has(name);

	return action === 'list' || action === 'view'
		? allows(grant.read) || allows(grant.write)
		: allows(grant.write);
}
