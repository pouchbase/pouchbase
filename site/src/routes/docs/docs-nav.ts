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

/** A part of the docs with a sidebar of its own, chosen with the tabs above it. */
export interface DocsTab {
	label: string;
	/** Iconify name; literal so the icon bundler can find it. */
	icon: string;
	/** What the part is about, e.g. for the link to it. */
	description: string;
	groups: DocsGroup[];
}

export function isSection(item: DocsItem): item is DocsSection {
	return 'items' in item;
}

/** Pouchbase itself: installing it, and what the dashboard sets up. */
const platform: DocsTab = {
	label: 'Platform',
	icon: 'lucide:layout-dashboard',
	description: 'Install Pouchbase and set up your app in the dashboard.',
	groups: [
		{
			label: 'Getting started',
			items: [
				{ label: 'Overview', href: resolve('/docs/platform/getting-started') },
				{
					label: 'Installation',
					items: [
						{
							label: 'Cloudflare Workers',
							href: resolve('/docs/platform/getting-started/cloudflare-workers')
						},
						{ label: 'Docker', href: resolve('/docs/platform/getting-started/docker') },
						{
							label: 'Single binary',
							href: resolve('/docs/platform/getting-started/single-binary')
						}
					]
				}
			]
		},
		{
			label: 'Build your app',
			items: [
				{ label: 'Authentication', href: resolve('/docs/platform/authentication') },
				{
					label: 'Collections',
					items: [
						{ label: 'Overview', href: resolve('/docs/platform/collections') },
						{ label: 'Access rules', href: resolve('/docs/platform/collections/access-rules') },
						{ label: 'Filters', href: resolve('/docs/platform/collections/filters') },
						{ label: 'Files', href: resolve('/docs/platform/collections/files') },
						{ label: 'Export and import', href: resolve('/docs/platform/collections/schema') }
					]
				},
				{ label: 'Functions', href: resolve('/docs/platform/functions') },
				{ label: 'Email templates', href: resolve('/docs/platform/email') },
				{ label: 'Realtime', href: resolve('/docs/platform/realtime') },
				{ label: 'API keys', href: resolve('/docs/platform/api-keys') }
			]
		}
	]
};

/** `@pouchbasejs/js-sdk`, the TypeScript client. */
const sdk: DocsTab = {
	label: 'JS SDK',
	icon: 'lucide:braces',
	description: 'Use Pouchbase from TypeScript with @pouchbasejs/js-sdk.',
	groups: [
		{
			label: 'Getting started',
			items: [
				{ label: 'Installation', href: resolve('/docs/sdk/getting-started') },
				{ label: 'TypeScript types', href: resolve('/docs/sdk/types') },
				{ label: 'Errors', href: resolve('/docs/sdk/errors') }
			]
		},
		{
			label: 'In your app',
			items: [
				{ label: 'Authentication', href: resolve('/docs/sdk/authentication') },
				{ label: 'Records', href: resolve('/docs/sdk/records') },
				{ label: 'Filters', href: resolve('/docs/sdk/filters') },
				{ label: 'Realtime', href: resolve('/docs/sdk/realtime') },
				{ label: 'Files', href: resolve('/docs/sdk/files') },
				{ label: 'Functions', href: resolve('/docs/sdk/functions') }
			]
		},
		{
			label: 'On your server',
			items: [
				{ label: 'API keys', href: resolve('/docs/sdk/api-keys') },
				{ label: 'Email', href: resolve('/docs/sdk/mail') },
				{ label: 'Schema', href: resolve('/docs/sdk/schema') }
			]
		}
	]
};

/** The HTTP API, for other languages and clients. */
const api: DocsTab = {
	label: 'REST API',
	icon: 'lucide:terminal',
	description: 'Call the HTTP API from any language.',
	groups: [
		{
			label: 'Basics',
			items: [{ label: 'Introduction', href: resolve('/docs/api/introduction') }]
		},
		{
			label: 'Endpoints',
			items: [
				{ label: 'Authentication', href: resolve('/docs/api/authentication') },
				{ label: 'Records', href: resolve('/docs/api/records') },
				{ label: 'Realtime', href: resolve('/docs/api/realtime') },
				{ label: 'Files', href: resolve('/docs/api/files') },
				{ label: 'Functions', href: resolve('/docs/api/functions') },
				{ label: 'Email', href: resolve('/docs/api/mail') },
				{ label: 'Schema and types', href: resolve('/docs/api/schema') }
			]
		}
	]
};

/** Plugins, and the UI components they and the dashboard are built from. */
const plugins: DocsTab = {
	label: 'Plugins',
	icon: 'lucide:puzzle',
	description: 'Extend Pouchbase with plugins and build their UI.',
	groups: [
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
				{ label: 'Overview', href: resolve('/docs/plugins/ui') },
				...uiCategories.map((category) => ({
					label: category.title,
					items: uiComponents
						.filter((component) => component.category === category.id)
						.map((component) => ({
							label: component.title,
							href: resolve('/docs/plugins/ui/[component=slug]', { component: component.slug })
						}))
				}))
			]
		}
	]
};

/** The parts of the docs, in the order of their tabs. */
export const docsTabs: DocsTab[] = [platform, sdk, api, plugins];

/** The links in an item, in reading order, flattening its sections. */
function links(item: DocsItem): DocsLink[] {
	return isSection(item) ? item.items.flatMap(links) : [item];
}

/** Every page of a tab, in reading order. */
function tabLinks(tab: DocsTab): DocsLink[] {
	return tab.groups.flatMap((group) => group.items.flatMap(links));
}

/** The first page of a tab, which its tab links to. */
export function tabHref(tab: DocsTab) {
	return tabLinks(tab)[0].href;
}

/** Whether the page at `pathname` is in the item (or is the item). */
export function containsPage(item: DocsItem, pathname: string) {
	return links(item).some((link) => link.href === pathname);
}

/** The tab of the page at `pathname`; the first tab for a page that isn't in any. */
export function docsTab(pathname: string): DocsTab {
	return docsTabs.find((tab) => tabLinks(tab).some((link) => link.href === pathname)) ?? platform;
}

/** The link of the page at `pathname`, e.g. for the label of the mobile menu button. */
export function docsLink(pathname: string) {
	return tabLinks(docsTab(pathname)).find((link) => link.href === pathname);
}

/** The pages before and after a docs page, in the reading order of its tab. */
export function docsNeighbours(pathname: string) {
	const tabPages = tabLinks(docsTab(pathname));
	const index = tabPages.findIndex((link) => link.href === pathname);

	if (index === -1) {
		return { previous: undefined, next: undefined };
	}

	return { previous: tabPages[index - 1], next: tabPages[index + 1] };
}

/** A docs page with the labels of the sections it is in, e.g. for `llms.txt`. */
export interface DocsOutlineLink extends DocsLink {
	sections: string[];
}

function outlineLinks(item: DocsItem, sections: string[]): DocsOutlineLink[] {
	return isSection(item)
		? item.items.flatMap((child) => outlineLinks(child, [...sections, item.label]))
		: [{ ...item, sections }];
}

/** Every page of a group, in reading order, with the sections around it. */
export function groupOutline(group: DocsGroup): DocsOutlineLink[] {
	return group.items.flatMap((item) => outlineLinks(item, []));
}

/** Every docs page, in the order of the tabs. */
export function allDocsLinks(): DocsLink[] {
	return docsTabs.flatMap(tabLinks);
}
