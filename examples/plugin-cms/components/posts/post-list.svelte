<script lang="ts">
	import type { PluginApi } from '@pouchbasejs/plugin-sdk/ui';

	import * as Button from '@pouchbasejs/ui/button';
	import * as Callout from '@pouchbasejs/ui/callout';
	import * as Empty from '@pouchbasejs/ui/empty';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Input from '@pouchbasejs/ui/inputs/input';
	import * as Skeleton from '@pouchbasejs/ui/skeleton';
	import * as Table from '@pouchbasejs/ui/table';
	import { onMount } from 'svelte';

	import { pageHref, request } from '../../lib/api.js';
	import { icons } from '../../lib/icons.js';
	import type { PostFilter, PostList } from '../../lib/posts.js';
	import PostRow from './post-row.svelte';

	type Props = {
		api: PluginApi;
	};

	let { api }: Props = $props();

	const FILTERS: { value: PostFilter; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'published', label: 'Published' },
		{ value: 'draft', label: 'Drafts' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'trash', label: 'Trash' }
	];

	let filter = $state<PostFilter>('all');
	let search = $state('');
	let query = $state('');
	let page = $state(1);

	let list = $state<PostList | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let siteUrl = $state<string | null>(null);

	const pages = $derived(list ? Math.max(1, Math.ceil(list.total / list.perPage)) : 1);

	async function load() {
		loading = true;
		error = null;

		const params = { status: filter, page: String(page), ...(query ? { q: query } : {}) };

		try {
			list = await request<PostList>(api, `/posts?${new URLSearchParams(params)}`);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not load the posts';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
		request<{ url: string | null }>(api, '/site')
			.then((site) => (siteUrl = site.url))
			.catch(() => {});
	});

	function show(next: PostFilter) {
		filter = next;
		page = 1;
		void load();
	}

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		query = search.trim();
		page = 1;
		void load();
	}

	function goTo(next: number) {
		page = next;
		void load();
	}

	async function act(id: string, action: 'trash' | 'restore' | 'delete') {
		try {
			if (action === 'delete') {
				await request(api, `/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
			} else {
				await request(api, `/posts/${encodeURIComponent(id)}`, {
					method: 'PATCH',
					body: { status: action === 'trash' ? 'trash' : 'draft' }
				});
			}

			await load();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not change the post';
		}
	}
</script>

<div class="flex flex-col gap-5">
	<header class="flex flex-wrap items-center gap-3">
		<h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Posts</h1>
		<Button.Root variant="secondary" href={pageHref('new')}>
			<Icon.Root src={icons.plus} />
			Add new post
		</Button.Root>
	</header>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<!-- The status links of the WordPress posts screen, with how many posts each has. -->
		<nav aria-label="Filter posts by status">
			<ul class="flex flex-wrap items-center text-sm text-zinc-400">
				{#each FILTERS.filter((item) => item.value === 'all' || (list?.counts[item.value] ?? 0) > 0 || item.value === filter) as item, i (item.value)}
					<li class="flex items-center">
						{#if i > 0}
							<span class="px-2" aria-hidden="true">|</span>
						{/if}
						<button
							type="button"
							aria-current={filter === item.value || undefined}
							class="text-blue-700 hover:underline aria-current:font-semibold aria-current:text-zinc-900 aria-current:hover:no-underline"
							onclick={() => show(item.value)}
						>
							{item.label}
							<span class="font-normal text-zinc-500">({list?.counts[item.value] ?? '…'})</span>
						</button>
					</li>
				{/each}
			</ul>
		</nav>

		<form class="flex gap-2" role="search" onsubmit={submitSearch}>
			<Input.Root type="search" bind:value={search} aria-label="Search posts" class="w-56" />
			<Button.Root type="submit" variant="secondary">Search posts</Button.Root>
		</form>
	</div>

	{#if error}
		<Callout.Root variant="error">{error}</Callout.Root>
	{/if}

	{#if list && !list.items.length && !loading}
		<Empty.Root>
			<Empty.Icon><Icon.Root src={icons.newspaper} /></Empty.Icon>
			<Empty.Title>
				{query
					? `No posts found for “${query}”`
					: filter === 'trash'
						? 'The trash is empty'
						: 'No posts found'}
			</Empty.Title>
			<Empty.Description>Posts are stored in the cms_posts collection.</Empty.Description>
			{#if filter !== 'trash'}
				<Button.Root href={pageHref('new')}>Write your first post</Button.Root>
			{/if}
		</Empty.Root>
	{:else if list || loading}
		<Table.Root>
			<Table.Header>
				<Table.Row class="border-b border-zinc-200">
					<Table.Head class="w-[45%]">Title</Table.Head>
					<Table.Head>Categories</Table.Head>
					<Table.Head>Tags</Table.Head>
					<Table.Head class="w-44">Date</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if !list}
					{#each [1, 2, 3] as row (row)}
						<Table.Row class="border-b border-zinc-100 last:border-0">
							<Table.Cell class="py-3"><Skeleton.Root class="h-4 w-56" /></Table.Cell>
							<Table.Cell><Skeleton.Root class="h-4 w-20" /></Table.Cell>
							<Table.Cell><Skeleton.Root class="h-4 w-16" /></Table.Cell>
							<Table.Cell><Skeleton.Root class="h-4 w-28" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else}
					{#each list.items as post (post.id)}
						<PostRow {post} {siteUrl} onaction={(action) => act(post.id, action)} />
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>

		{#if list}
			<div class="flex items-center justify-end gap-3 text-sm text-zinc-500">
				<span>{list.total} {list.total === 1 ? 'item' : 'items'}</span>
				{#if pages > 1}
					<div class="flex items-center gap-1">
						<Button.Root
							variant="secondary"
							size="icon"
							aria-label="Previous page"
							disabled={page <= 1 || loading}
							onclick={() => goTo(page - 1)}
						>
							<Icon.Root src={icons.chevronLeft} />
						</Button.Root>
						<span class="px-2 tabular-nums">{page} of {pages}</span>
						<Button.Root
							variant="secondary"
							size="icon"
							aria-label="Next page"
							disabled={page >= pages || loading}
							onclick={() => goTo(page + 1)}
						>
							<Icon.Root src={icons.chevronLeft} class="rotate-180" />
						</Button.Root>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
