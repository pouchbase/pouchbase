import { defineParams } from '@sveltejs/kit/params';

export const params = defineParams({
	// A lowercase kebab-case slug, so e.g. `/docs/plugins/ui/button.md` reaches the Markdown route.
	slug: (param) => (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(param) ? param : undefined)
});
