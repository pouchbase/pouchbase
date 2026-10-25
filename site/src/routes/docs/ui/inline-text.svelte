<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import { resolve } from '$app/paths';

	interface Props {
		/** Text of `#lib/ui-components.ts`: `code`, and [links](/docs/ui/<slug>#<hash>) to the UI docs. */
		text: string;
	}

	let { text }: Props = $props();

	type Part =
		| { kind: 'text'; text: string }
		| { kind: 'code'; text: string }
		| { kind: 'link'; text: string; href: string };

	/** The URL of a link in the text, which only points at the UI docs. */
	function href(target: string) {
		const [path, hash] = target.split('#');
		const slug = path.replace(/^\/docs\/ui\/?/, '');
		const url = slug ? resolve('/docs/ui/[component]', { component: slug }) : resolve('/docs/ui');

		return hash ? `${url}#${hash}` : url;
	}

	const parts = $derived.by(() => {
		const list: Part[] = [];
		const pattern = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
		let last = 0;

		for (const match of text.matchAll(pattern)) {
			if (match.index > last) {
				list.push({ kind: 'text', text: text.slice(last, match.index) });
			}

			if (match[1] !== undefined) {
				list.push({ kind: 'code', text: match[1] });
			} else {
				list.push({ kind: 'link', text: match[2], href: href(match[3]) });
			}

			last = match.index + match[0].length;
		}

		if (last < text.length) {
			list.push({ kind: 'text', text: text.slice(last) });
		}

		return list;
	});
</script>

{#each parts as part, index (index)}
	{#if part.kind === 'code'}
		<Code.Root>{part.text}</Code.Root>
	{:else if part.kind === 'link'}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built with resolve() above -->
		<a href={part.href}>{part.text}</a>
	{:else}
		{part.text}
	{/if}
{/each}
