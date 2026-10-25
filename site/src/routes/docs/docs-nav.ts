import { uiCategories, uiComponents } from '#lib/ui-components.js';
import { resolve } from '$app/paths';

export interface DocsLink {
	label: string;
	href: string;
}

/** A collapsible section of the sidebar, with links and further sections inside. */
export interface DocsSection {
	label: string;
	items: DocsItem[];
}

export type DocsItem = DocsLink | DocsSection;

export interface DocsGroup {
	label: string;
	items: DocsItem[];
}

export function isSection(item: DocsItem): item is DocsSection {
	return 'items' in item;
}

/** The docs sidebar, in reading order. */
export const docsNavigation: DocsGroup[] = [
	{
		label: 'Getting started',
		items: [
			{ label: 'Overview', href: resolve('/docs/getting-started') },
			{
				label: 'Installation',
				items: [
					{
						label: 'Cloudflare Workers',
						href: resolve('/docs/getting-started/cloudflare-workers')
					},
					{ label: 'Docker', href: resolve('/docs/getting-started/docker') },
					{ label: 'Single binary', href: resolve('/docs/getting-started/single-binary') }
				]
			}
		]
	},
	{
		label: 'Build your app',
		items: [
			{ label: 'Authentication', href: resolve('/docs/authentication') },
			{ label: 'Collections and records', href: resolve('/docs/collections') },
			{ label: 'Functions', href: resolve('/docs/functions') },
			{ label: 'Email templates', href: resolve('/docs/email') },
			{
				label: 'Realtime',
				items: [
					{ label: 'Overview', href: resolve('/docs/realtime') },
					{ label: 'Subscriptions', href: resolve('/docs/realtime/subscriptions') },
					{ label: 'Protocol', href: resolve('/docs/realtime/protocol') }
				]
			}
		]
	},
	{
		label: 'Plugins',
		items: [
			{ label: 'Overview', href: resolve('/docs/plugins') },
			{ label: 'Project structure', href: resolve('/docs/plugins/project-structure') },
			{
				label: 'Dashboard UI',
				items: [
					{ label: 'Field types', href: resolve('/docs/plugins/field-types') },
					{ label: 'Pages', href: resolve('/docs/plugins/pages') },
					{ label: 'Components and icons', href: resolve('/docs/plugins/components') },
					{ label: 'Settings', href: resolve('/docs/plugins/settings') }
				]
			},
			{
				label: 'Server',
				items: [
					{ label: 'Routes', href: resolve('/docs/plugins/routes') },
					{ label: 'Sign-in providers', href: resolve('/docs/plugins/sign-in-providers') },
					{ label: 'Collections', href: resolve('/docs/plugins/collections') }
				]
			},
			{
				label: 'Release',
				items: [
					{ label: 'Testing and debugging', href: resolve('/docs/plugins/testing') },
					{ label: 'Publishing and updates', href: resolve('/docs/plugins/publishing') },
					{ label: 'Security and limits', href: resolve('/docs/plugins/security') }
				]
			},
			{ label: 'CLI reference', href: resolve('/docs/plugins/cli') }
		]
	},
	{
		label: 'UI components',
		items: [
			{ label: 'Overview', href: resolve('/docs/ui') },
			...uiCategories.map((category) => ({
				label: category.title,
				items: uiComponents
					.filter((component) => component.category === category.id)
					.map((component) => ({
						label: component.title,
						href: resolve('/docs/ui/[component]', { component: component.slug })
					}))
			}))
		]
	}
];

/** The links in an item, in reading order, flattening its sections. */
function links(item: DocsItem): DocsLink[] {
	return isSection(item) ? item.items.flatMap(links) : [item];
}

/** Whether the page at `pathname` is in the item (or is the item). */
export function containsPage(item: DocsItem, pathname: string) {
	return links(item).some((link) => link.href === pathname);
}

/** Every page of the docs, in reading order. */
const docsLinks = docsNavigation.flatMap((group) => group.items.flatMap(links));

/** The link of the page at `pathname`, e.g. for the label of the mobile menu button. */
export function docsLink(pathname: string) {
	return docsLinks.find((link) => link.href === pathname);
}

/** The pages before and after a docs page, in reading order. */
export function docsNeighbours(pathname: string) {
	const index = docsLinks.findIndex((link) => link.href === pathname);

	if (index === -1) {
		return { previous: undefined, next: undefined };
	}

	return { previous: docsLinks[index - 1], next: docsLinks[index + 1] };
}
