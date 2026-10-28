<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import PostList from '../components/posts/post-list.svelte';

	let { api }: PageProps = $props();
</script>

<PostList {api} />
