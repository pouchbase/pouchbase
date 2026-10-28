<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Table from '@pouchbasejs/ui/table';

	import { formatDate, pageHref } from '../../lib/api.js';
	import { icons } from '../../lib/icons.js';
	import { isScheduled, statusLabel, type PostWithCategories } from '../../lib/posts.js';

	type Props = {
		post: PostWithCategories;
		siteUrl: string | null;
		onaction: (action: 'trash' | 'restore' | 'delete') => Promise<void>;
	};

	let { post, siteUrl, onaction }: Props = $props();

	const href = $derived(pageHref(`edit/${post.id}`));
	const trashed = $derived(post.status === 'trash');

	/** "— Draft" after the title, as in the WordPress list; nothing for a published post. */
	const suffix = $derived(
		[
			post.status !== 'published' || isScheduled(post) ? statusLabel(post) : null,
			post.sticky ? 'Sticky' : null
		]
			.filter(Boolean)
			.join(', ')
	);

	const date = $derived(
		post.status === 'published' && post.published_at
			? { label: isScheduled(post) ? 'Scheduled' : 'Published', value: post.published_at }
			: { label: 'Last modified', value: post.updated_at }
	);

	let busy = $state(false);

	async function run(action: 'trash' | 'restore' | 'delete') {
		busy = true;

		try {
			await onaction(action);
		} finally {
			busy = false;
		}
	}
</script>

<Table.Row class={['group border-b border-zinc-100 last:border-0', busy && 'opacity-50']}>
	<Table.Cell class="py-3 align-top">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-1.5">
				{#if post.sticky}
					<Icon.Root src={icons.pin} class="size-3.5 text-zinc-500" label="Sticky" />
				{/if}
				{#if trashed}
					<span class="font-semibold text-zinc-900">{post.title || '(no title)'}</span>
				{:else}
					<a {href} class="font-semibold text-blue-700 hover:text-blue-900 hover:underline">
						{post.title || '(no title)'}
					</a>
				{/if}
				{#if suffix}
					<span class="font-semibold text-zinc-500">— {suffix}</span>
				{/if}
			</div>

			<!-- Row actions: shown on hover or focus, like on the WordPress posts screen. -->
			<div
				class="flex items-center gap-1.5 text-[13px] opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
			>
				{#if trashed}
					<button
						type="button"
						class="text-blue-700 hover:underline"
						onclick={() => run('restore')}
					>
						Restore
					</button>
					<span class="text-zinc-300">|</span>
					<button type="button" class="text-red-700 hover:underline" onclick={() => run('delete')}>
						Delete permanently
					</button>
				{:else}
					<a {href} class="text-blue-700 hover:underline">Edit</a>
					<span class="text-zinc-300">|</span>
					<button type="button" class="text-red-700 hover:underline" onclick={() => run('trash')}>
						Trash
					</button>
					{#if siteUrl && post.status === 'published'}
						<span class="text-zinc-300">|</span>
						<a
							href="{siteUrl}/{post.slug}"
							target="_blank"
							rel="noreferrer"
							class="text-blue-700 hover:underline">View</a
						>
					{/if}
				{/if}
			</div>
		</div>
	</Table.Cell>
	<Table.Cell class="py-3 align-top">
		{post.categories.length
			? post.categories.map((category) => category.name).join(', ')
			: 'Uncategorized'}
	</Table.Cell>
	<Table.Cell class="py-3 align-top text-zinc-500">
		{post.tags?.length ? post.tags.join(', ') : '—'}
	</Table.Cell>
	<Table.Cell class="py-3 align-top">
		<div class="flex flex-col text-[13px]">
			<span class="text-zinc-900">{date.label}</span>
			<span class="text-zinc-500 tabular-nums">{formatDate(date.value)}</span>
		</div>
	</Table.Cell>
</Table.Row>
