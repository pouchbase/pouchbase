import { defineCollection } from '@pouchbasejs/plugin-sdk/server';

/**
 * The demo's own collection, `demo_notes` in Pouchbase: Pouchbase creates it when the plugin is
 * installed, brings it in line on every update (keeping fields a later version leaves out) and
 * deletes it, with its notes, when the plugin is removed. The plugin always reaches it through
 * `ctx.pouch`; without `rules` app users can't, so `/notes` decides who sees what.
 */
export default defineCollection({
	fields: [
		{ name: 'text', type: 'text', required: true },
		// `collection` names the related collection: one of the plugin's own by its name, else the app's.
		{ name: 'author', type: 'relation', required: true, options: { collection: 'users' } }
	],
	indexes: [{ columns: ['author'] }]
});
