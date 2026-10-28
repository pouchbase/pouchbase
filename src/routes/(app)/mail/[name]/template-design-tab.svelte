<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Code from '#lib/components/ui/inputs/code/index.js';
	import * as EmailEditor from '#lib/components/ui/inputs/email-editor/index.js';
	import { parseTemplate } from '#lib/mail/template.js';
	import ImagePickerDialog from './image-picker-dialog.svelte';
	import type { TemplateDraft } from './template-draft.svelte';
	import TemplatePreview from './template-preview.svelte';
	import TemplateStyle from './template-style.svelte';
	import TemplateWidthToggle from './template-width-toggle.svelte';

	type Props = {
		draft: TemplateDraft;
		/** The sender the preview shows; `null` when mail isn't set up. */
		from: string | null;
	};

	let { draft, from }: Props = $props();

	const dialogs = Dialog.getDialogs();

	function bodyDiagnostics(value: string) {
		const parsed = parseTemplate(value);

		return parsed.ok ? [] : parsed.problems;
	}
</script>

{#if draft.editor === 'visual'}
	<div class="overflow-clip rounded-xl border border-zinc-200 bg-white">
		<EmailEditor.Root
			bind:value={draft.body}
			mailStyle={draft.style}
			variables={draft.variableNames}
			pickImage={(current) => dialogs.open(ImagePickerDialog, { current })}
			onReady={(value) => {
				if (draft.body === draft.saved.body) {
					draft.savedBody = value;
					draft.body = value;
				}
			}}
		>
			<EmailEditor.Toolbar class="sticky top-0 z-10" />

			<div class="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
				<EmailEditor.Canvas class="min-h-[40rem]" />
				<EmailEditor.Inspector class="border-t border-zinc-200 lg:border-t-0 lg:border-l">
					{#snippet fallback()}
						<TemplateStyle bind:style={draft.style} />
					{/snippet}
				</EmailEditor.Inspector>
			</div>
		</EmailEditor.Root>
	</div>

	<p class="text-sm text-zinc-500">
		Variables: <code>{'{{name}}'}</code>, a fallback with <code>{'{{name | there}}'}</code>, and
		blocks with <code>{'{{#if paid}}…{{else}}…{{/if}}'}</code> and
		<code>{'{{#each items}}…{{/each}}'}</code>. Put a block tag in a paragraph or list item of its
		own to repeat or hide everything up to its closing tag.
	</p>
{:else}
	<div class="grid items-start gap-4 xl:grid-cols-2">
		<Code.Root
			bind:value={draft.body}
			language="html"
			diagnostics={bodyDiagnostics}
			aria-label="HTML of the email"
			class="h-[44rem]"
		/>
		<div class="flex flex-col gap-2">
			<div class="flex justify-end"><TemplateWidthToggle {draft} /></div>
			<TemplatePreview {draft} {from} />
		</div>
	</div>
{/if}
