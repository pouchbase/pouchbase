# CMS plugin

An example [Pouchbase](https://pouchbase.io) plugin that turns an instance into a small CMS: a posts collection and a post editor in the dashboard that works like the WordPress block editor. It is built only on the public contract of [`@pouchbasejs/plugin-sdk`](../../packages/plugin-sdk), like any third-party plugin; for a tour of every part of the SDK, see [`plugin-demo`](../plugin-demo).

`plugin.ts` adds:

- two **collections** (`collections`), created on install:
  - `cms_posts` (`collections/posts.ts`): `title`, `slug` (unique), `content` (a Rich text field, as HTML), `excerpt`, `status` (`draft`, `pending`, `published` or `trash`), `published_at`, `featured_image`, `sticky`, `categories` (a relation to `cms_categories`) and `tags` (JSON). Its API rules let apps read published posts whose publish date has passed, and nothing else;
  - `cms_categories` (`collections/categories.ts`): `name` and `slug`, readable by everyone;
- three **dashboard pages** (`pages`):
  - **Posts** (`/plugins/cms/posts`): the posts screen of WordPress, at the dashboard's reading width, with the status links (All, Published, Drafts, Pending, Trash) and their counts, search, paging and the row actions Edit, Trash, View, Restore and Delete permanently;
  - **Add new post** (`/plugins/cms/posts/new`): the editor for a new post, with `layout: 'full'`, so it takes all of the space below the dashboard's top bar;
  - **Edit post** (`/plugins/cms/posts/edit/<id>`): the same editor for an existing post, without a sidebar link (`navigation: false`); the id is the path below the page (`params`). The longest page path wins, so `posts/new` and `posts/edit` aren't taken for `posts`;
- eight **routes** under `/api/plugins/cms/`, all for admins of the dashboard (`ctx.admin`) except `GET /site`: `GET`/`POST /posts`, `GET`/`PATCH`/`DELETE /posts/:id`, `GET`/`POST /categories` and `GET /site`;
- one **setting**, `site_url`: where the posts are published. The editor shows a post's permalink (`<site URL>/<slug>`) and links to it once it is published.

## The editor

`components/editor/post-editor.svelte` follows the WordPress block editor:

- a top bar with the inserter (`+`), the document bar (the title and status), **Save draft** / **Switch to draft**, **Publish** / **Schedule** / **Update**, **View post** and the settings toggle; <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>S</kbd> saves;
- a large **Add title** field, then the post as **blocks**: paragraph, heading (H2 to H4), list (bulleted or numbered), quote with citation, image (by URL, with caption and alt text), code, separator and custom HTML;
- a **block toolbar** above the selected block, hidden while typing: change the block's type, heading levels, list style, bold, italic, link, move up or down, remove;
- the keyboard of the block editor: <kbd>Enter</kbd> splits a block, <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a line break, <kbd>Backspace</kbd> at the start merges a block into the one before (or turns a heading, quote or list back into a paragraph), the arrow keys move between blocks, <kbd>/</kbd> in an empty paragraph opens the block menu, and the Markdown shortcuts `## `, `- `, `1. `, `> `, ` ``` ` and `---`;
- a **sidebar** with a Post tab (featured image, status, publish date, slug, sticky, Move to trash, then the Excerpt, Categories with **Add new category**, Tags and Details panels with the word count and reading time) and a Block tab with the selected block's settings.

A post is stored as plain HTML (`lib/blocks.ts`: `blocksToHtml`), so apps render `content` as is and the dashboard's record form edits the same field. When the editor opens a post it turns the HTML back into blocks (`htmlToBlocks`), whoever wrote it: known elements become their block, anything else a Custom HTML block. Text that goes into the editable blocks is cleaned first (`sanitizeInline`: only inline tags such as `<strong>` and `<a href>`, no attributes or scripts), and pasted text comes in as plain text.

## Reading posts in an app

With [`@pouchbasejs/js-sdk`](../../packages/js-sdk), an app reads the published posts without an API key, because the collection's rules allow it:

```ts
const posts = await pouch.db.cms_posts.findMany({
	orderBy: { sticky: 'desc', published_at: 'desc' },
	include: { categories: true },
	limit: 10
});
```

Sanitize `content` before rendering it, as with any HTML that admins write.

## Layout

```
plugin-cms/
├── pouchbase-plugin.json     # id, name, categories, engines
├── plugin.ts                 # definePlugin({ settings, collections, pages, routes })
├── icon.svg
├── collections/              # posts.ts, categories.ts: defineCollection
├── pages/
│   ├── posts.svelte          # the list
│   ├── new-post.svelte       # the editor for a new post (layout: 'full')
│   └── edit-post.svelte      # the editor for /posts/edit/<id> (layout: 'full', no sidebar link)
├── components/
│   ├── popover.svelte
│   ├── posts/                # post-list.svelte, post-row.svelte
│   └── editor/               # post-editor.svelte and its parts: editor-header, block, block-toolbar,
│                             # block-inserter, slash-menu, rich-text, post-sidebar, block-settings, …
├── routes/                   # posts.ts, post.ts, categories.ts, site.ts
├── lib/
│   ├── posts.ts              # the post model and parsePostInput, shared by the routes and the pages
│   ├── store.ts              # server code of the routes: ctx.pouch, admin check, unique slugs
│   ├── blocks.ts             # the blocks, to and from HTML
│   ├── caret.ts              # the caret in a contenteditable block
│   ├── autosize.ts           # an attachment that grows a textarea with its text
│   ├── api.ts                # request(): api.fetch with JSON and errors
│   └── icons.ts              # Lucide icons as data URLs, for Icon.Root src
└── test/                     # posts, blocks and routes, with fakeContext and fakePouch
```

## Things to notice

- Routes are public, so every route that writes checks `ctx.admin` (`adminOnly` in `lib/store.ts`); `ctx.pouch` doesn't apply the collection's API rules, which are for app users.
- A new post gets a slug from its title, made unique like WordPress does (`hello-world`, `hello-world-2`, …), and a publish date when it is published without one; a date in the future schedules it.
- A page receives `params`, the path below it: `pages/edit-post.svelte` reads the post id from `/plugins/cms/posts/edit/<id>`.
- `layout` sets how much of the dashboard a page takes: the editor pages use `full` and fill the height themselves (the editor's root is `flex-1` and its canvas and sidebar scroll on their own); the list keeps the `default` reading width.
- The icons inside the components are data URLs (`lib/icons.ts`) for `Icon.Root src`, which always renders; `icon="lucide:…"` only renders at once for icons the dashboard bundles itself.
- UI files may only import the modules Pouchbase provides; the CLI checks the source of `.svelte` files, so even `import type` from another module, such as `svelte/elements`, is refused. `rich-text.svelte` declares its props itself for that reason.
- `document.execCommand` formats the selected text (bold, italic, links). It is deprecated, but still the one way to do this in every browser without an editor library, which a plugin can't bring along.
- A new post keeps its place at `/plugins/cms/posts/new` after the first save; the editor remembers the post's id, so later saves update it.

## Scripts

From the repository root (the SDK's CLI runs from its `dist/`, so build it first with `pnpm --filter @pouchbasejs/plugin-sdk build`):

```sh
pnpm --filter pouchbase-plugin-cms dev        # rebuild on every change, serve on http://localhost:4510
pnpm --filter pouchbase-plugin-cms validate
pnpm --filter pouchbase-plugin-cms build      # write dist/cms-<version>.json
pnpm --filter pouchbase-plugin-cms test
pnpm --filter pouchbase-plugin-cms check
pnpm --filter pouchbase-plugin-cms release    # build and publish to $POUCHBASE_REGISTRY_URL
```

To try it, start Pouchbase with `POUCHBASE_REGISTRY_URL=http://localhost:4510 pnpm dev:app` while `dev` runs and install **CMS** from the Plugins page. The plugin has server code, so this deploys its Worker to the Cloudflare account in your `.env`. Then open **Plugins › Posts** in the sidebar.

To publish it to the development registry instead (see `registry/README.md`), create a publish token under **Account** on `http://localhost:5174` and run `release` with `POUCHBASE_REGISTRY_URL=http://localhost:5174` and `POUCHBASE_REGISTRY_TOKEN=pbp_…`. A version can be published once, so raise `version` in `package.json` before publishing a change. The Release workflow never publishes this plugin: `scripts/publish-plugins.mjs` only publishes the plugins in `plugins/`.
