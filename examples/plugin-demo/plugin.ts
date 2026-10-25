import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import notes from './collections/notes.js';
import color from './fields/color/field.js';
import phone from './fields/phone/field.js';
import rating from './fields/rating/field.js';
import Api from './pages/api.svelte';
import Fields from './pages/fields.svelte';
import Overview from './pages/overview.svelte';
import * as echo from './routes/echo.js';
import * as githubStatus from './routes/github-status.js';
import * as info from './routes/info.js';
import * as item from './routes/item.js';
import * as me from './routes/me.js';
import * as notesRoute from './routes/notes.js';

/**
 * Everything the demo adds, by id. The files are imported from wherever the plugin keeps them:
 * here a folder per kind, but any layout works.
 */
const plugin = definePlugin({
	/**
	 * The settings: an admin fills them in on the Plugins page, and the server code reads them with
	 * `await ctx.settings.get(key)`. A number setting comes back as a number, a boolean setting as a
	 * boolean, the others as strings; `null` while there is no value, unless the setting has a
	 * default (a required setting without one is `null` until an admin saves it). Add one with
	 * `pouchbase-plugin add setting <key>`.
	 */
	settings: [
		{
			key: 'greeting',
			label: 'Greeting',
			description: 'How GET /info greets, e.g. Hello or Welcome.',
			type: 'text',
			default: 'Hello'
		},
		{
			key: 'max_length',
			label: 'Longest message',
			description: 'The longest message POST /echo accepts, in characters.',
			type: 'number',
			default: 280
		},
		{
			key: 'shout',
			label: 'Shout',
			description: 'Whether POST /echo answers in capitals.',
			type: 'boolean',
			default: false
		}
	],

	// `demo:color`, `demo:phone` and `demo:rating`; each is defineField(...) in its own folder.
	fields: { color, phone, rating },

	// `/plugins/demo/<path>`, linked in the sidebar in this order.
	pages: {
		overview: { title: 'Demo', icon: 'lucide:layout-dashboard', component: Overview },
		fields: { title: 'Field playground', icon: 'lucide:shapes', component: Fields },
		api: { title: 'API explorer', icon: 'lucide:terminal', component: Api }
	},

	// `demo_notes`: created on install; the server code uses it through `ctx.pouch`.
	collections: { notes },

	// `/api/plugins/demo/<path>`: each module exports a handler per method it answers.
	routes: {
		'/info': info,
		'/echo': echo,
		'/items/:id': item,
		'/me': me,
		'/notes': notesRoute,
		'/github-status': githubStatus
	}
});

export default plugin;

// Types ctx.settings.get(key) everywhere in the plugin, from the settings above.
declare module '@pouchbasejs/plugin-sdk/server' {
	interface Register {
		plugin: typeof plugin;
	}
}
