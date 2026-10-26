<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import PostEditor from '../components/editor/post-editor.svelte';
	import PostList from '../components/posts/post-list.svelte';

	let { params, api }: PageProps = $props();

	// `/plugins/cms/posts` lists the posts; `/plugins/cms/posts/<id>` edits one.
	const id = $derived(params[0] ?? null);
</script>

{#if id}
	{#key id}
		<PostEditor {api} {id} />
	{/key}
{:else}
	<PostList {api} />
{/if}
