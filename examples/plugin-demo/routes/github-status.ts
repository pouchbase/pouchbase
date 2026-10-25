import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

type GitHubStatus = { status: { indicator: string; description: string } };

/**
 * `GET /github-status`: calls an outside API through `ctx.fetch`, which only reaches the hosts in
 * `permissions.network` (here `www.githubstatus.com`).
 */
export const GET: RouteHandler = async (_request, ctx) => {
	const response = await ctx.fetch('https://www.githubstatus.com/api/v2/status.json', {
		headers: { Accept: 'application/json' }
	});

	if (!response.ok) {
		ctx.log.warn('GitHub status unavailable', { status: response.status });

		return Response.json({ error: 'GitHub status unavailable' }, { status: 502 });
	}

	const { status } = (await response.json()) as GitHubStatus;

	return Response.json({ indicator: status.indicator, description: status.description });
};
