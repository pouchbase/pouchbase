<script lang="ts" module>
	/** A parent page in the breadcrumb, e.g. `{ label: 'Functions', href: resolve('/(app)/functions') }`. */
	export interface Crumb {
		label: string;
		href: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Breadcrumb from '../breadcrumb/index.js';
	import * as Topbar from '../topbar/index.js';
	import PageDescription from './page-description.svelte';
	import PageHeader from './page-header.svelte';
	import PageRoot from './page-root.svelte';
	import PageTitle from './page-title.svelte';

	type Props = {
		title: string;
		/** Last item of the breadcrumb; defaults to `title`. */
		crumb?: string;
		/** Parent pages shown before `crumb` in the breadcrumb. */
		parents?: Crumb[];
		description?: string | Snippet;
		/** Shown next to the title, e.g. status badges. */
		badges?: Snippet;
		/** Buttons or controls on the right of the header. */
		actions?: Snippet;
		width?: 'narrow' | 'default' | 'wide';
		gap?: 'tight' | 'default' | 'loose';
		children: Snippet;
	};

	let {
		title,
		crumb = title,
		parents = [],
		description,
		badges,
		actions,
		width = 'default',
		gap = 'default',
		children
	}: Props = $props();

	const widths = { narrow: 'max-w-3xl', default: 'max-w-5xl', wide: 'max-w-7xl' };
	const gaps = { tight: 'gap-4', default: 'gap-6', loose: 'gap-10' };
</script>

<Topbar.Root>
	<Breadcrumb.Root>
		{#each parents as parent (parent.href)}
			<Breadcrumb.Item>
				<Breadcrumb.Link href={parent.href}>{parent.label}</Breadcrumb.Link>
			</Breadcrumb.Item>
			<Breadcrumb.Separator />
		{/each}
		<Breadcrumb.Item>
			<Breadcrumb.Page>{crumb}</Breadcrumb.Page>
		</Breadcrumb.Item>
	</Breadcrumb.Root>
</Topbar.Root>

<PageRoot>
	<div class={['mx-auto flex w-full flex-col', widths[width], gaps[gap]]}>
		<PageHeader>
			<div class={['flex flex-col gap-1', badges && 'min-w-0']}>
				{#if badges}
					<div class="flex flex-wrap items-center gap-2">
						<PageTitle>{title}</PageTitle>
						{@render badges()}
					</div>
				{:else}
					<PageTitle>{title}</PageTitle>
				{/if}

				{#if typeof description === 'string'}
					<PageDescription>{description}</PageDescription>
				{:else if description}
					<PageDescription>{@render description()}</PageDescription>
				{/if}
			</div>

			{@render actions?.()}
		</PageHeader>

		{@render children()}
	</div>
</PageRoot>
