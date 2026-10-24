import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/** `GET /info`: who the plugin is and a setting, with a fallback while none is entered. */
export const info: RouteHandler = async (_request, ctx) => {
	const greeting = (await ctx.settings.get('greeting')) ?? 'Hello';

	ctx.log.info('Info requested');

	return Response.json({ id: ctx.plugin.id, version: ctx.plugin.version, greeting });
};

/** `POST /echo`: reads a JSON body and answers 422 when it isn't what the route expects. */
export const echo: RouteHandler = async (request) => {
	const body: unknown = await request.json().catch(() => null);
	const message =
		body && typeof body === 'object' && 'message' in body
			? (body as { message: unknown }).message
			: null;

	if (typeof message !== 'string' || !message.trim()) {
		return Response.json({ error: 'Send { "message": "..." }' }, { status: 422 });
	}

	return Response.json({ message: message.trim(), length: message.trim().length });
};

type GitHubStatus = { status: { indicator: string; description: string } };

/**
 * `GET /github-status`: calls an outside API through `ctx.fetch`, which only reaches the hosts in
 * `permissions.network` (here `www.githubstatus.com`).
 */
export const githubStatus: RouteHandler = async (_request, ctx) => {
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
