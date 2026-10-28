<script lang="ts">
	import * as EmailPreview from '#lib/components/ui/email-preview/index.js';
	import { templateDocument } from '#lib/mail/mail-templates.js';
	import type { TemplateDraft } from './template-draft.svelte';

	type Props = {
		draft: TemplateDraft;
		/** The sender the preview shows; `null` when mail isn't set up. */
		from: string | null;
	};

	let { draft, from }: Props = $props();
</script>

<EmailPreview.Root
	html={draft.rendered?.html ?? templateDocument(draft.content)}
	subject={draft.rendered?.subject ?? draft.subject}
	from={from ?? undefined}
	width={draft.width}
	class="h-[44rem]"
/>
