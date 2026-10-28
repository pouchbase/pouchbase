<script lang="ts">
	import type * as EmailPreview from '#lib/components/ui/email-preview/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Segmented from '#lib/components/ui/segmented/index.js';
	import type { TemplateDraft } from './template-draft.svelte';

	let { draft }: { draft: TemplateDraft } = $props();
</script>

<Segmented.Root
	value={draft.width}
	onValueChange={(next) => (draft.width = next as EmailPreview.Width)}
	aria-label="Preview width"
>
	<Segmented.Item value="desktop" aria-label="Desktop">
		<Icon.Root icon="lucide:monitor" />
	</Segmented.Item>
	<Segmented.Item value="mobile" aria-label="Phone">
		<Icon.Root icon="lucide:smartphone" />
	</Segmented.Item>
</Segmented.Root>
