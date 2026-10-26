<script lang="ts">
	import type { PluginApi } from '@pouchbasejs/plugin-sdk/ui';

	import * as Button from '@pouchbasejs/ui/button';
	import * as Callout from '@pouchbasejs/ui/callout';
	import * as Spinner from '@pouchbasejs/ui/spinner';
	import { flushSync, onMount } from 'svelte';

	import { ApiError, pageHref, request } from '../../lib/api.js';
	import { autosize } from '../../lib/autosize.js';
	import {
		blocksToHtml,
		createBlock,
		htmlToBlocks,
		inlineHtmlOf,
		postStats,
		type Block,
		type BlockType
	} from '../../lib/blocks.js';
	import { placeCaret } from '../../lib/caret.js';
	import type {
		Category,
		PostFields,
		PostInput,
		PostStatus,
		PostWithCategories
	} from '../../lib/posts.js';
	import BlockView from './block.svelte';
	import { setEditorContext, type CaretPlace } from './editor-context.js';
	import EditorHeader from './editor-header.svelte';
	import PostSidebar from './post-sidebar.svelte';

	type Props = {
		api: PluginApi;
		/** The post to edit; `null` writes a new one. */
		id: string | null;
	};

	let { api, id }: Props = $props();

	// A new post gets its id on the first save; the page stays the same.
	let postId = $state<string | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let post = $state<PostFields>({
		title: '',
		slug: '',
		excerpt: '',
		status: 'draft',
		published_at: null,
		featured_image: null,
		sticky: false,
		categories: [],
		tags: []
	});
	let blocks = $state<Block[]>([createBlock('paragraph')]);

	let savedStatus = $state<PostStatus | null>(null);
	let savedSnapshot = $state('');
	let saving = $state(false);
	let error = $state<ApiError | null>(null);
	let notice = $state<{ message: string; link?: string } | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	let categories = $state<Category[]>([]);
	let siteUrl = $state<string | null>(null);

	let selected = $state<string | null>(null);
	let sidebarOpen = $state(true);
	let tab = $state<'post' | 'block'>('post');
	let root = $state<HTMLElement | null>(null);

	const input = $derived<PostInput>({ ...post, content: blocksToHtml(blocks) });
	const dirty = $derived(JSON.stringify(input) !== savedSnapshot);
	const stats = $derived(postStats(post.title, blocks));
	const selectedIndex = $derived(blocks.findIndex((block) => block.id === selected));
	const viewUrl = $derived(
		siteUrl && savedStatus === 'published' ? `${siteUrl}/${post.slug}` : null
	);
	const errors = $derived(error?.errors ?? {});

	onMount(() => {
		postId = id;

		Promise.all([
			id ? request<PostWithCategories>(api, `/posts/${encodeURIComponent(id)}`) : null,
			request<Category[]>(api, '/categories'),
			request<{ url: string | null }>(api, '/site')
		])
			.then(([saved, allCategories, site]) => {
				categories = allCategories;
				siteUrl = site.url;

				if (saved) {
					const loaded = htmlToBlocks(saved.content ?? '');

					blocks = loaded.length ? loaded : [createBlock('paragraph')];
					apply(saved);
				} else {
					savedSnapshot = JSON.stringify(input);
				}
			})
			.catch((cause: unknown) => {
				loadError = cause instanceof Error ? cause.message : 'Could not load the post';
			})
			.finally(() => {
				loading = false;
			});

		return () => clearTimeout(noticeTimer);
	});

	/** Takes over what the server saved: the unique slug, the publish date, the status. */
	function apply(saved: PostWithCategories) {
		postId = saved.id;
		savedStatus = saved.status;
		post = {
			title: saved.title ?? '',
			slug: saved.slug,
			excerpt: saved.excerpt ?? '',
			status: saved.status,
			published_at: saved.published_at,
			featured_image: saved.featured_image,
			sticky: saved.sticky,
			categories: saved.categories.map((category) => category.id),
			tags: saved.tags ?? []
		};
		savedSnapshot = JSON.stringify({ ...post, content: blocksToHtml(blocks) });
	}

	function showNotice(message: string, link?: string) {
		clearTimeout(noticeTimer);
		notice = { message, link };
		noticeTimer = setTimeout(() => (notice = null), 5000);
	}

	async function save(changes: Partial<PostInput> = {}) {
		saving = true;
		error = null;

		try {
			const body = { ...input, ...changes };
			const saved = await request<PostWithCategories>(
				api,
				postId ? `/posts/${encodeURIComponent(postId)}` : '/posts',
				{ method: postId ? 'PATCH' : 'POST', body }
			);
			const wasPublished = savedStatus === 'published';

			apply(saved);

			return { saved, wasPublished };
		} catch (cause) {
			error = cause instanceof ApiError ? cause : new ApiError('Could not save the post', 0, {});
			return null;
		} finally {
			saving = false;
		}
	}

	async function saveDraft() {
		const status = post.status === 'published' || post.status === 'trash' ? 'draft' : post.status;
		const result = await save({ status });

		if (result) {
			showNotice(
				result.wasPublished
					? 'Post reverted to draft.'
					: status === 'pending'
						? 'Post saved as pending.'
						: 'Draft saved.'
			);
		}
	}

	async function publish() {
		// A published post keeps the status picked in the sidebar; any other post is published.
		const status = savedStatus === 'published' ? post.status : 'published';
		const result = await save({ status });

		if (!result) {
			return;
		}

		const link =
			siteUrl && result.saved.status === 'published'
				? `${siteUrl}/${result.saved.slug}`
				: undefined;

		if (result.saved.status !== 'published') {
			showNotice(`Post saved as ${result.saved.status}.`);
		} else if (result.saved.published_at && Date.parse(result.saved.published_at) > Date.now()) {
			showNotice('Post scheduled.', link);
		} else {
			showNotice(result.wasPublished ? 'Post updated.' : 'Post published.', link);
		}
	}

	async function trash() {
		const result = await save({ status: 'trash' });

		if (result) {
			showNotice('Post moved to the trash.');
		}
	}

	async function restore() {
		const result = await save({ status: 'draft' });

		if (result) {
			showNotice('Post restored as a draft.');
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();

			if (!saving && dirty) {
				void (savedStatus === 'published' ? publish() : saveDraft());
			}
		}
	}

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (dirty && !loading) {
			event.preventDefault();
		}
	}

	// What the blocks, their toolbars and the inserters do to the post.
	function indexOf(blockId: string) {
		return blocks.findIndex((block) => block.id === blockId);
	}

	// Applies the change to the DOM right away (`flushSync`), so the next key already goes to the
	// block. Waiting for `tick()` instead can take longer than the time between two key presses.
	function focus(blockId: string, where: CaretPlace = 'start') {
		flushSync();

		const element = root?.querySelector<HTMLElement>(
			`[data-block="${CSS.escape(blockId)}"] [data-editable]`
		);

		if (!element) {
			return;
		}

		if (element.isContentEditable) {
			placeCaret(element, where);
		} else {
			element.focus();

			if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
				const position = where === 'start' ? 0 : element.value.length;

				element.setSelectionRange(position, position);
			}
		}
	}

	function insertBlock(type: BlockType) {
		const block = createBlock(type);
		const current = blocks[selectedIndex];

		// An empty paragraph is where the new block goes, as in the WordPress editor.
		if (current?.type === 'paragraph' && !current.html) {
			editor.replace(current.id, block);
		} else {
			editor.insert(block, current?.id ?? null);
		}
	}

	function appendParagraph() {
		const last = blocks.at(-1);

		if (last?.type === 'paragraph' && !last.html) {
			focus(last.id);
		} else {
			editor.insert(createBlock('paragraph'), null);
		}
	}

	const editor = {
		get blocks() {
			return blocks;
		},
		get selected() {
			return selected;
		},
		select(blockId: string | null) {
			selected = blockId;
		},
		insert(block: Block, after: string | null) {
			const index = after ? indexOf(after) + 1 : blocks.length;

			blocks.splice(index, 0, block);
			selected = block.id;
			focus(block.id, 'start');
		},
		replace(blockId: string, block: Block) {
			const index = indexOf(blockId);

			if (index === -1) {
				return;
			}

			blocks[index] = block;
			selected = block.id;
			focus(block.id, 'end');
		},
		remove(blockId: string) {
			const index = indexOf(blockId);

			if (index === -1) {
				return;
			}

			blocks.splice(index, 1);

			if (!blocks.length) {
				blocks.push(createBlock('paragraph'));
			}

			const next = blocks[Math.max(0, index - 1)];

			selected = next.id;
			focus(next.id, index > 0 ? 'end' : 'start');
		},
		move(blockId: string, delta: -1 | 1) {
			const index = indexOf(blockId);
			const target = index + delta;

			if (index === -1 || target < 0 || target >= blocks.length) {
				return;
			}

			[blocks[index], blocks[target]] = [blocks[target], blocks[index]];
			focus(blockId, 'end');
		},
		transform(blockId: string, type: BlockType) {
			const index = indexOf(blockId);
			const block = blocks[index];

			if (!block || block.type === type) {
				return;
			}

			editor.replace(blockId, createBlock(type, inlineHtmlOf(block)));
		},
		mergeWithPrevious(blockId: string) {
			const index = indexOf(blockId);
			const previous = blocks[index - 1];
			const block = blocks[index];

			if (
				!previous ||
				!block ||
				(previous.type !== 'paragraph' && previous.type !== 'heading' && previous.type !== 'quote')
			) {
				return false;
			}

			// The caret goes where the two texts meet.
			const element = root?.querySelector<HTMLElement>(
				`[data-block="${CSS.escape(previous.id)}"] [data-editable]`
			);
			const offset = element?.textContent?.length ?? 'end';

			previous.html += inlineHtmlOf(block);
			blocks.splice(index, 1);
			selected = previous.id;
			focus(previous.id, offset);

			return true;
		},
		focus(blockId: string, where?: CaretPlace) {
			focus(blockId, where);
		},
		focusSibling(blockId: string, delta: -1 | 1) {
			const sibling = blocks[indexOf(blockId) + delta];

			if (!sibling) {
				return false;
			}

			selected = sibling.id;
			focus(sibling.id, delta < 0 ? 'end' : 'start');

			return true;
		}
	};

	setEditorContext(editor);

	// Enter in the title goes on with the post, in an empty paragraph at the top.
	function handleTitleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') {
			return;
		}

		event.preventDefault();

		const first = blocks[0];

		if (first?.type === 'paragraph' && !first.html) {
			selected = first.id;
			focus(first.id);
			return;
		}

		const paragraph = createBlock('paragraph');

		blocks.unshift(paragraph);
		selected = paragraph.id;
		focus(paragraph.id);
	}
</script>

<svelte:window onkeydown={handleKeydown} onbeforeunload={handleBeforeUnload} />

<div
	bind:this={root}
	class="relative flex h-[calc(100dvh-9rem)] min-h-[34rem] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
>
	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<Spinner.Root />
		</div>
	{:else if loadError}
		<div class="flex flex-1 flex-col items-center justify-center gap-4 p-6">
			<Callout.Root variant="error">{loadError}</Callout.Root>
			<Button.Root variant="secondary" href={pageHref()}>Back to posts</Button.Root>
		</div>
	{:else}
		<EditorHeader
			{post}
			{savedStatus}
			{dirty}
			{saving}
			{viewUrl}
			bind:sidebarOpen
			onsave={saveDraft}
			onpublish={publish}
			oninsert={insertBlock}
		/>

		<div class="relative flex min-h-0 flex-1">
			<div class="min-w-0 flex-1 overflow-y-auto">
				<div class="mx-auto flex max-w-[42rem] flex-col gap-5 px-8 pt-14 pb-10">
					{#if savedStatus === 'trash'}
						<Callout.Root variant="warning">
							<Callout.Body>
								<Callout.Title>This post is in the trash</Callout.Title>
								<Callout.Description>
									Apps don't see it. Restore it to keep working on it.
								</Callout.Description>
							</Callout.Body>
							<Button.Root variant="secondary" onclick={restore}>Restore</Button.Root>
						</Callout.Root>
					{/if}

					{#if error}
						<Callout.Root variant="error">
							<Callout.Body>
								<Callout.Title>{error.message}</Callout.Title>
								{#if Object.keys(errors).length}
									<Callout.Description>
										{Object.entries(errors)
											.map(([field, message]) => `${field}: ${message}`)
											.join(' · ')}
									</Callout.Description>
								{/if}
							</Callout.Body>
						</Callout.Root>
					{/if}

					<textarea
						bind:value={post.title}
						{@attach autosize(post.title)}
						onkeydown={handleTitleKeydown}
						onfocus={() => (selected = null)}
						rows="1"
						placeholder="Add title"
						aria-label="Add title"
						class="mb-4 block w-full resize-none overflow-hidden border-none bg-transparent p-0 font-serif text-[2.75rem]/[1.15] font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-0"
					></textarea>

					{#each blocks as block, i (block.id)}
						<BlockView bind:block={blocks[i]} />
					{/each}
				</div>

				<!-- Clicking below the last block continues the post, as in the WordPress editor. -->
				<button
					type="button"
					class="block h-40 w-full cursor-text"
					aria-label="Add a paragraph at the end"
					onclick={appendParagraph}
				></button>
			</div>

			{#if sidebarOpen}
				<div
					class="absolute inset-y-0 right-0 z-30 w-72 border-l border-zinc-200 shadow-xl md:static md:shadow-none"
				>
					<PostSidebar
						{api}
						bind:post
						bind:categories
						bind:block={blocks[selectedIndex]}
						bind:tab
						{siteUrl}
						saved={!!postId && savedStatus !== 'trash'}
						{stats}
						{errors}
						ontrash={trash}
						onclose={() => (sidebarOpen = false)}
					/>
				</div>
			{/if}

			{#if notice}
				<div
					role="status"
					class="absolute bottom-4 left-4 z-40 flex items-center gap-4 rounded-md bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg"
				>
					{notice.message}
					{#if notice.link}
						<a
							href={notice.link}
							target="_blank"
							rel="noreferrer"
							class="font-medium underline underline-offset-2">View post</a
						>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
