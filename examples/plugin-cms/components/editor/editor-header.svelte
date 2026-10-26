<script lang="ts">
	import * as Badge from '@pouchbasejs/ui/badge';
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';

	import { pageHref } from '../../lib/api.js';
	import type { BlockType } from '../../lib/blocks.js';
	import { icons } from '../../lib/icons.js';
	import { isScheduled, STATUS_LABELS, type PostFields, type PostStatus } from '../../lib/posts.js';
	import Popover from '../popover.svelte';
	import BlockInserter from './block-inserter.svelte';

	type Props = {
		post: PostFields;
		/** The status the post is saved with; `null` for a post that was never saved. */
		savedStatus: PostStatus | null;
		dirty: boolean;
		saving: boolean;
		/** Where the published post is, with the Site URL setting; `null` otherwise. */
		viewUrl: string | null;
		sidebarOpen: boolean;
		/** Saves without publishing: as a draft (or pending review), or back to draft when published. */
		onsave: () => Promise<void>;
		onpublish: () => Promise<void>;
		oninsert: (type: BlockType) => void;
	};

	let {
		post,
		savedStatus,
		dirty,
		saving,
		viewUrl,
		sidebarOpen = $bindable(),
		onsave,
		onpublish,
		oninsert
	}: Props = $props();

	let inserterOpen = $state(false);
	let inserterButton = $state<HTMLElement | null>(null);

	const published = $derived(savedStatus === 'published');

	const primaryLabel = $derived(published ? 'Update' : isScheduled(post) ? 'Schedule' : 'Publish');

	const secondaryLabel = $derived(
		published ? 'Switch to draft' : post.status === 'pending' ? 'Save as pending' : 'Save draft'
	);

	const saveState = $derived(
		saving ? 'Saving…' : dirty ? (savedStatus ? 'Unsaved changes' : 'Not saved yet') : 'Saved'
	);
</script>

<header class="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white pr-3">
	<a
		href={pageHref()}
		class="group flex size-14 shrink-0 items-center justify-center bg-zinc-900 text-white hover:bg-zinc-700"
		aria-label="All posts"
		title="All posts"
	>
		<Icon.Root src={icons.newspaper} class="size-6 group-hover:hidden" />
		<Icon.Root src={icons.chevronLeft} class="hidden size-6 group-hover:block" />
	</a>

	<div class="relative">
		<Button.Root
			bind:ref={inserterButton}
			size="icon"
			aria-label="Add block"
			title="Add block"
			aria-expanded={inserterOpen}
			onmousedown={(event: MouseEvent) => event.preventDefault()}
			onclick={() => (inserterOpen = !inserterOpen)}
		>
			<Icon.Root
				src={icons.plus}
				class={inserterOpen ? 'rotate-45 transition-transform' : 'transition-transform'}
			/>
		</Button.Root>

		<Popover bind:open={inserterOpen} anchor={inserterButton} label="Add block">
			<BlockInserter
				onpick={(type) => {
					inserterOpen = false;
					oninsert(type);
				}}
			/>
		</Popover>
	</div>

	<!-- The document bar: which post this is, as in the WordPress editor. -->
	<div class="flex min-w-0 flex-1 justify-center px-2">
		<div
			class="flex h-control max-w-sm min-w-0 items-center gap-2 rounded-md bg-zinc-100 px-3 text-sm"
		>
			<Icon.Root src={icons.fileText} class="size-4 text-zinc-500" />
			<span class="truncate font-medium text-zinc-900">{post.title || 'No title'}</span>
			<span class="shrink-0 text-zinc-500">· Post</span>
			{#if savedStatus}
				<Badge.Root variant={published ? 'success' : 'outline'} class="shrink-0">
					{published && isScheduled(post) ? 'Scheduled' : STATUS_LABELS[savedStatus]}
				</Badge.Root>
			{/if}
		</div>
	</div>

	<span class="hidden text-xs text-zinc-500 lg:inline" aria-live="polite">{saveState}</span>

	{#if viewUrl}
		<Button.Root variant="ghost" href={viewUrl} target="_blank" rel="noreferrer">
			View post
			<Icon.Root src={icons.externalLink} />
		</Button.Root>
	{/if}

	<Button.Root variant="ghost" disabled={saving || (!dirty && !published)} onclick={onsave}>
		{secondaryLabel}
	</Button.Root>

	<Button.Root disabled={saving || (published && !dirty)} onclick={onpublish}>
		{primaryLabel}
	</Button.Root>

	<Button.Root
		variant="ghost"
		size="icon"
		aria-label="Settings"
		title="Settings"
		aria-pressed={sidebarOpen}
		class={sidebarOpen ? 'bg-zinc-900 text-white hover:bg-zinc-700 hover:text-white' : ''}
		onclick={() => (sidebarOpen = !sidebarOpen)}
	>
		<Icon.Root src={icons.panelRight} />
	</Button.Root>
</header>
