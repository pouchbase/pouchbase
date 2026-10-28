<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import type { TemplateDraft } from './template-draft.svelte';
	import TemplatePreview from './template-preview.svelte';

	type Props = {
		draft: TemplateDraft;
		/** The sender the preview shows; `null` when mail isn't set up. */
		from: string | null;
	};

	let { draft, from }: Props = $props();
</script>

{#if !draft.sample.ok}
	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:circle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Description>The sample data isn't a valid JSON object.</Callout.Description>
		</Callout.Body>
	</Callout.Root>
{:else if draft.missing.length}
	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:circle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Description>
				Required variables missing from the sample data: {draft.missing.join(', ')}. Sending without
				them fails.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>
{/if}

<TemplatePreview {draft} {from} />
