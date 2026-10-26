<script lang="ts">
	import type { PluginApi } from '@pouchbasejs/plugin-sdk/ui';

	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Checkbox from '@pouchbasejs/ui/inputs/checkbox';
	import * as Input from '@pouchbasejs/ui/inputs/input';
	import * as Select from '@pouchbasejs/ui/inputs/select';
	import * as Textarea from '@pouchbasejs/ui/inputs/textarea';

	import type { Block, postStats } from '../../lib/blocks.js';
	import { icons } from '../../lib/icons.js';
	import {
		isScheduled,
		slugify,
		STATUS_LABELS,
		type Category,
		type PostFields,
		type PostStatus
	} from '../../lib/posts.js';
	import BlockSettings from './block-settings.svelte';
	import CategoryPicker from './category-picker.svelte';
	import FeaturedImage from './featured-image.svelte';
	import SidebarPanel from './sidebar-panel.svelte';
	import TagInput from './tag-input.svelte';

	type Props = {
		api: PluginApi;
		post: PostFields;
		categories: Category[];
		/** The selected block, for the Block tab. */
		block: Block | undefined;
		tab: 'post' | 'block';
		/** Where posts are published, before the slug in the permalink; `null` without the setting. */
		siteUrl: string | null;
		/** Whether the post exists, so it can be trashed. */
		saved: boolean;
		stats: ReturnType<typeof postStats>;
		errors: Record<string, string>;
		ontrash: () => Promise<void>;
		onclose: () => void;
	};

	let {
		api,
		post = $bindable(),
		categories = $bindable(),
		block = $bindable(),
		tab = $bindable(),
		siteUrl,
		saved,
		stats,
		errors,
		ontrash,
		onclose
	}: Props = $props();

	const id = $props.id();

	const STATUS_DESCRIPTIONS = {
		draft: 'Not ready to publish.',
		pending: 'Waiting for review before publishing.',
		published: 'Visible to everyone.'
	};

	const STATUS_ITEMS = (['draft', 'pending', 'published'] as const).map((value) => ({
		value,
		label: STATUS_LABELS[value],
		description: STATUS_DESCRIPTIONS[value]
	}));

	const TABS = [
		{ value: 'post', label: 'Post' },
		{ value: 'block', label: 'Block' }
	] as const;

	/** `published_at` as the `datetime-local` input wants it, in local time. */
	const localDate = $derived.by(() => {
		if (!post.published_at) {
			return '';
		}

		const date = new Date(post.published_at);

		return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
	});

	const permalink = $derived(`${siteUrl ?? ''}/${post.slug || slugify(post.title) || '…'}`);

	const details = $derived([
		{ label: 'Words', value: stats.words },
		{ label: 'Characters', value: stats.characters },
		{ label: 'Reading time', value: `${stats.minutes} min` },
		{ label: 'Headings', value: stats.headings },
		{ label: 'Paragraphs', value: stats.paragraphs },
		{ label: 'Blocks', value: stats.blocks }
	]);
</script>

<aside class="flex h-full w-full flex-col bg-white" aria-label="Settings">
	<div class="flex h-12 shrink-0 items-stretch border-b border-zinc-200 pr-2">
		<div role="tablist" aria-label="Settings" class="flex flex-1 items-stretch">
			{#each TABS as item (item.value)}
				<button
					type="button"
					role="tab"
					aria-selected={tab === item.value}
					onclick={() => (tab = item.value)}
					class="relative px-4 text-sm font-medium text-zinc-600 hover:text-zinc-900 aria-selected:text-zinc-900 aria-selected:after:absolute aria-selected:after:inset-x-0 aria-selected:after:bottom-0 aria-selected:after:h-0.5 aria-selected:after:bg-zinc-900"
				>
					{item.label}
				</button>
			{/each}
		</div>
		<Button.Root
			variant="ghost"
			size="icon"
			class="self-center"
			aria-label="Close settings"
			onclick={onclose}
		>
			<Icon.Root src={icons.x} />
		</Button.Root>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
		{#if tab === 'block'}
			<BlockSettings bind:block />
		{:else}
			<section class="flex flex-col gap-4 border-b border-zinc-200 p-4">
				<FeaturedImage bind:url={post.featured_image} />
				{#if errors.featured_image}
					<p class="text-xs text-red-600">{errors.featured_image}</p>
				{/if}

				<dl class="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 text-sm">
					<dt class="flex h-control items-center">
						<span id="{id}-status-label" class="text-zinc-600">Status</span>
					</dt>
					<dd>
						<Select.Root
							aria-labelledby="{id}-status-label"
							items={STATUS_ITEMS}
							value={post.status === 'trash' ? 'draft' : post.status}
							onValueChange={(value) => (post.status = value as PostStatus)}
							class="w-full"
						/>
					</dd>

					<dt class="flex h-control items-center">
						<label for="{id}-date" class="text-zinc-600">Publish</label>
					</dt>
					<dd class="flex flex-col gap-1">
						<Input.Root
							id="{id}-date"
							type="datetime-local"
							value={localDate}
							onchange={(event) => {
								const value = event.currentTarget.value;

								post.published_at = value ? new Date(value).toISOString() : null;
							}}
							aria-invalid={!!errors.published_at || undefined}
							class="w-full px-2 text-xs"
						/>
						<span class="text-xs text-zinc-500">
							{#if !post.published_at}
								Immediately
							{:else if isScheduled(post)}
								Scheduled for later
							{:else}
								<button
									type="button"
									class="text-blue-700 hover:underline"
									onclick={() => (post.published_at = null)}
								>
									Reset to immediately
								</button>
							{/if}
						</span>
					</dd>

					<dt class="flex h-control items-center">
						<label for="{id}-slug" class="text-zinc-600">Slug</label>
					</dt>
					<dd class="flex flex-col gap-1">
						<Input.Root
							id="{id}-slug"
							bind:value={post.slug}
							placeholder={slugify(post.title) || 'from-the-title'}
							aria-invalid={!!errors.slug || undefined}
							class="w-full"
						/>
						{#if errors.slug}
							<span class="text-xs text-red-600">{errors.slug}</span>
						{/if}
					</dd>
				</dl>

				<p class="truncate text-xs text-zinc-500" title={siteUrl ? permalink : undefined}>
					{#if siteUrl}
						{permalink}
					{:else}
						Set the Site URL of the CMS plugin to see the permalink.
					{/if}
				</p>

				<div class="flex items-center gap-2">
					<Checkbox.Root id="{id}-sticky" bind:checked={post.sticky} />
					<label for="{id}-sticky" class="text-sm text-zinc-800">Stick to the top of the blog</label
					>
				</div>

				{#if saved}
					<Button.Root variant="secondary" class="w-full text-red-700" onclick={ontrash}>
						<Icon.Root src={icons.trash2} />
						Move to trash
					</Button.Root>
				{/if}
			</section>

			<SidebarPanel title="Excerpt">
				<Textarea.Root
					bind:value={post.excerpt}
					aria-label="Excerpt"
					placeholder="Write an excerpt (optional)"
					class="min-h-24"
				/>
				<p class="text-xs text-zinc-500">
					Shown in lists of posts. Leave it empty to use the start of the post.
				</p>
			</SidebarPanel>

			<SidebarPanel title="Categories">
				<CategoryPicker {api} bind:categories bind:selected={post.categories} />
			</SidebarPanel>

			<SidebarPanel title="Tags">
				<TagInput id="{id}-tags" bind:tags={post.tags} />
				{#if errors.tags}
					<p class="text-xs text-red-600">{errors.tags}</p>
				{/if}
			</SidebarPanel>

			<SidebarPanel title="Details" open={false}>
				<dl class="grid grid-cols-2 gap-3 text-sm">
					{#each details as item (item.label)}
						<div class="flex flex-col">
							<dt class="text-xs text-zinc-500">{item.label}</dt>
							<dd class="font-medium text-zinc-900 tabular-nums">{item.value}</dd>
						</div>
					{/each}
				</dl>
			</SidebarPanel>
		{/if}
	</div>
</aside>
