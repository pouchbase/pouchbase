import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import categories from './collections/categories.js';
import posts from './collections/posts.js';
import NewPost from './pages/new-post.svelte';
import Posts from './pages/posts.svelte';
import * as categoriesRoute from './routes/categories.js';
import * as post from './routes/post.js';
import * as postsRoute from './routes/posts.js';
import * as site from './routes/site.js';

const plugin = definePlugin({
	settings: [
		{
			key: 'site_url',
			label: 'Site URL',
			description:
				'Where the posts are published, e.g. https://example.com/blog; a post is at <site URL>/<slug>.',
			type: 'url'
		}
	],

	// `cms_posts` and `cms_categories`, created on install.
	collections: { posts, categories },

	// `/plugins/cms/posts` lists the posts and edits one at `/plugins/cms/posts/<id>`;
	// `/plugins/cms/posts/new` is the longer path, so it opens the editor for a new post.
	pages: {
		posts: { title: 'Posts', icon: 'lucide:newspaper', component: Posts },
		'posts/new': { title: 'Add new post', icon: 'lucide:square-pen', component: NewPost }
	},

	// `/api/plugins/cms/<path>`, for the pages; admins only, except `/site`.
	routes: {
		'/posts': postsRoute,
		'/posts/:id': post,
		'/categories': categoriesRoute,
		'/site': site
	}
});

export default plugin;

// Types ctx.settings.get(key) everywhere in the plugin, from the settings above.
declare module '@pouchbasejs/plugin-sdk/server' {
	interface Register {
		plugin: typeof plugin;
	}
}
