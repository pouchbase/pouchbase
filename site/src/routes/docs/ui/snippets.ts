import { snippet } from '#lib/highlight.js';

export const install = snippet(
	'bash',
	`
pnpm add @pouchbasejs/ui svelte bits-ui @iconify/svelte
pnpm add -D tailwindcss @tailwindcss/vite @iconify-json/lucide`
);

export const theme = snippet(
	'css',
	`
@import 'tailwindcss';
@import '@pouchbasejs/ui/theme.css';`
);

export const viteConfig = snippet(
	'typescript',
	`
import { icons as lucide } from '@iconify-json/lucide';
import { iconify } from '@pouchbasejs/ui/vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [iconify({ sets: [lucide], srcDirs: ['src'] }), tailwindcss(), sveltekit()]
});`
);

export const layout = snippet(
	'svelte',
	`
<script lang="ts">
	import 'virtual:iconify';

	let { children } = $props();
</script>

{@render children()}`
);

export const virtualModule = snippet(
	'typescript',
	`
declare module 'virtual:iconify' {}`
);

export const usage = snippet(
	'svelte',
	`
<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';
	import { Card } from '@pouchbasejs/ui';
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Backups</Card.Title>
	</Card.Header>
	<Card.Content>
		<Button.Root onclick={() => fetch('/backup', { method: 'POST' })}>
			<Icon.Root icon="lucide:plus" />
			New backup
		</Button.Root>
	</Card.Content>
</Card.Root>`
);
