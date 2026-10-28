<script lang="ts">
	import './layout.css';
	// Registers every icon used in `src` and in `@pouchbasejs/ui` (the `iconify` Vite plugin of
	// `@pouchbasejs/ui/vite`), so icons render on the server too.
	import 'virtual:iconify';
	import favicon from '#lib/assets/favicon.svg';
	import * as Toast from '#lib/components/ui/toast/index.js';
	import { MotionConfig } from 'motion-sv';
	import type { LayoutProps } from './$types';
	import SiteFooter from './site-footer.svelte';
	import SiteHeader from './site-header.svelte';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<MotionConfig reducedMotion="user">
	<div class="flex min-h-dvh flex-col">
		<SiteHeader />

		<main class="flex-1">
			{@render children()}
		</main>

		<SiteFooter />
	</div>
</MotionConfig>

<Toast.Root />
