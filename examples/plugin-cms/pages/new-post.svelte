<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import PostEditor from '../components/editor/post-editor.svelte';

	let { api }: PageProps = $props();
</script>

<PostEditor {api} id={null} />
