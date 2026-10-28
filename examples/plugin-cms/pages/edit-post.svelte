<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import PostEditor from '../components/editor/post-editor.svelte';

	let { params, api }: PageProps = $props();

	// `/plugins/cms/posts/edit/<id>`: the id is the path below the page.
	const id = $derived(params[0] ?? null);
</script>

{#key id}
	<PostEditor {api} {id} />
{/key}
