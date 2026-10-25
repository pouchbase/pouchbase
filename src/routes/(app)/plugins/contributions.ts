import type { ContributionSummary } from '@pouchbasejs/plugin-sdk';

type Summary = Partial<ContributionSummary>;

const KINDS = [
	{ key: 'fields', one: 'field type', many: 'field types', name: (item) => item.label },
	{ key: 'pages', one: 'page', many: 'pages', name: (item) => item.title },
	{
		key: 'authProviders',
		one: 'sign-in provider',
		many: 'sign-in providers',
		name: (item) => item.label
	},
	// The permissions list them by name.
	{ key: 'collections', one: 'collection', many: 'collections', name: null },
	{ key: 'routes', one: 'route', many: 'routes', name: null },
	{ key: 'settings', one: 'setting', many: 'settings', name: null }
] as const satisfies readonly {
	key: keyof ContributionSummary;
	one: string;
	many: string;
	name: ((item: { label?: string; title?: string }) => string | undefined) | null;
}[];

/**
 * What a plugin adds, in words: `1 field type (Rating), 1 page (Demo), 3 routes, 2 settings`
 * (`names: false` leaves out the names); an empty string when it adds nothing.
 */
export function describeContributions(
	summary: Summary | undefined,
	{ names = true }: { names?: boolean } = {}
): string {
	if (!summary) {
		return '';
	}

	return KINDS.flatMap((kind) => {
		const items = (summary[kind.key] ?? []) as readonly { label?: string; title?: string }[];

		if (!items.length) {
			return [];
		}

		const count = `${items.length} ${items.length === 1 ? kind.one : kind.many}`;
		const labels = names && kind.name ? items.map(kind.name).filter(Boolean) : [];

		return [labels.length ? `${count} (${labels.join(', ')})` : count];
	}).join(', ');
}
