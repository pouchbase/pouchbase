import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

/**
 * The plugin's settings: an admin fills them in on the Plugins page, and the server code reads them
 * with `await ctx.settings.get(key)`. A number setting comes back as a number, a boolean setting
 * as a boolean, the others as strings; `null` while there is no value, unless the setting has a
 * default (a required setting without one is `null` until an admin saves it). Add one with
 * `pouchbase-plugin add setting <key>`.
 */
const plugin = definePlugin({
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
	]
});

export default plugin;

// Types ctx.settings.get(key) everywhere in the plugin, from the settings above.
declare module '@pouchbasejs/plugin-sdk/server' {
	interface Register {
		plugin: typeof plugin;
	}
}
