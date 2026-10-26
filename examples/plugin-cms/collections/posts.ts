import { defineCollection } from '@pouchbasejs/plugin-sdk/server';

import { POST_STATUSES } from '../lib/posts.js';

/**
 * `cms_posts` in Pouchbase. The editor writes it through the plugin's routes; apps read it with the
 * records API (`pouch.db.cms_posts.findMany()`), which its rules limit to published posts whose
 * publish date has passed. `content` is a Rich text field, so the dashboard's record form edits
 * the same HTML as the editor.
 */
export default defineCollection({
	fields: [
		{ name: 'title', type: 'text' },
		{ name: 'slug', type: 'text', required: true, unique: true },
		{ name: 'content', type: 'rich_text', options: { format: 'html' } },
		{ name: 'excerpt', type: 'text' },
		{
			name: 'status',
			type: 'list',
			required: true,
			defaultValue: 'draft',
			options: { values: [...POST_STATUSES] }
		},
		{ name: 'published_at', type: 'date' },
		{ name: 'featured_image', type: 'url' },
		{ name: 'sticky', type: 'boolean' },
		// One of the plugin's own collections, by its name in `collections` of plugin.ts.
		{
			name: 'categories',
			type: 'relation',
			options: { collection: 'categories', multiple: true }
		},
		{ name: 'tags', type: 'json' }
	],
	indexes: [{ columns: ['status', 'published_at'] }],
	rules: {
		list: 'status == "published" and published_at <= now()',
		view: 'status == "published" and published_at <= now()'
	}
});
