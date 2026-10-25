import { resolve } from '$app/paths';

export interface DocsLink {
	label: string;
	href: string;
}

export interface DocsGroup {
	label: string;
	links: DocsLink[];
}

/** The docs sidebar, in reading order. */
export const docsNavigation: DocsGroup[] = [
	{
		label: 'Getting started',
		links: [
			{ label: 'Overview', href: resolve('/docs/getting-started') },
			{ label: 'Cloudflare Workers', href: resolve('/docs/getting-started/cloudflare-workers') },
			{ label: 'Docker', href: resolve('/docs/getting-started/docker') },
			{ label: 'Single binary', href: resolve('/docs/getting-started/single-binary') }
		]
	},
	{
		label: 'Build your app',
		links: [
			{ label: 'Authentication', href: resolve('/docs/authentication') },
			{ label: 'Collections and records', href: resolve('/docs/collections') },
			{ label: 'Live updates', href: resolve('/docs/live-updates') },
			{ label: 'Functions', href: resolve('/docs/functions') },
			{ label: 'Email templates', href: resolve('/docs/email') }
		]
	},
	{
		label: 'Plugins',
		links: [
			{ label: 'Overview', href: resolve('/docs/plugins') },
			{ label: 'Project structure', href: resolve('/docs/plugins/project-structure') },
			{ label: 'Field types', href: resolve('/docs/plugins/field-types') },
			{ label: 'Dashboard pages', href: resolve('/docs/plugins/pages') },
			{ label: 'Components and icons', href: resolve('/docs/plugins/components') },
			{ label: 'Routes', href: resolve('/docs/plugins/routes') },
			{ label: 'Sign-in providers', href: resolve('/docs/plugins/sign-in-providers') },
			{ label: 'Settings', href: resolve('/docs/plugins/settings') },
			{ label: 'Testing and debugging', href: resolve('/docs/plugins/testing') },
			{ label: 'Publishing and updates', href: resolve('/docs/plugins/publishing') },
			{ label: 'Security and limits', href: resolve('/docs/plugins/security') },
			{ label: 'CLI reference', href: resolve('/docs/plugins/cli') }
		]
	}
];

/** The pages before and after a docs page, in reading order. */
export function docsNeighbours(pathname: string) {
	const links = docsNavigation.flatMap((group) => group.links);
	const index = links.findIndex((link) => link.href === pathname);

	if (index === -1) {
		return { previous: undefined, next: undefined };
	}

	return { previous: links[index - 1], next: links[index + 1] };
}
