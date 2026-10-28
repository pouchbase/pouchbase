<script lang="ts">
	import { untrack } from 'svelte';
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as RowActions from '#lib/components/ui/row-actions/index.js';
	import * as Segmented from '#lib/components/ui/segmented/index.js';
	import { toast } from '#lib/components/ui/toast/index.js';
	import { templateDocument } from '#lib/mail/mail-templates.js';
	import { saveMailTemplate } from '../mail.remote';
	import type { MailTemplate } from '../types';
	import DeleteTemplateDialog from './delete-template-dialog.svelte';
	import ResetTemplateDialog from './reset-template-dialog.svelte';
	import SendTestDialog from './send-test-dialog.svelte';
	import SwitchEditorDialog from './switch-editor-dialog.svelte';
	import TemplateDataTab from './template-data-tab.svelte';
	import TemplateDesignTab from './template-design-tab.svelte';
	import { TemplateDraft } from './template-draft.svelte';
	import TemplateFields from './template-fields.svelte';
	import TemplatePreviewTab from './template-preview-tab.svelte';
	import TemplateUsage from './template-usage.svelte';
	import TemplateWidthToggle from './template-width-toggle.svelte';

	type Props = {
		template: MailTemplate;
		/** The sender the preview shows; `null` when mail isn't set up. */
		from: string | null;
		/** Where test emails go by default. */
		adminEmail: string;
	};

	let { template, from, adminEmail }: Props = $props();

	const dialogs = Dialog.getDialogs();

	// The editor starts from the saved template; the page creates it again after a save or reset.
	const draft = untrack(() => new TemplateDraft(template));

	const tabs = $derived([
		{ value: 'design', label: 'Design', icon: 'lucide:pencil-ruler' },
		{ value: 'preview', label: 'Preview', icon: 'lucide:eye' },
		{ value: 'data', label: 'Sample data', icon: 'lucide:braces' },
		...(template.system ? [] : [{ value: 'usage', label: 'Usage', icon: 'lucide:code' }])
	]);

	function errorMessage(error: unknown): string {
		const body = (error as { body?: { message?: unknown } } | null)?.body;

		if (typeof body?.message === 'string') {
			return body.message;
		}

		return error instanceof Error ? error.message : 'Something went wrong';
	}

	async function save() {
		draft.failure = null;

		if (!draft.sample.ok) {
			draft.failure = 'The sample data must be a JSON object';
			draft.tab = 'data';

			return;
		}

		try {
			await saveMailTemplate({
				name: template.name,
				description: draft.description,
				...draft.content,
				sampleData: draft.sampleData
			});
			toast.success('Template saved');
		} catch (error) {
			draft.failure = errorMessage(error);
		}
	}

	async function editAsHtml() {
		if (await dialogs.open(SwitchEditorDialog)) {
			draft.body = templateDocument(draft.content);
			draft.editor = 'html';
			draft.tab = 'design';
		}
	}

	function sendTest() {
		void dialogs.open(SendTestDialog, {
			content: draft.content,
			sampleData: draft.sampleData,
			to: adminEmail
		});
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center justify-end gap-2">
		{#if draft.changed}
			<Badge.Root variant="warning" class="mr-auto">Not saved</Badge.Root>
			<Button.Root variant="ghost" onclick={() => draft.discard()}>Discard changes</Button.Root>
		{/if}

		<Button.Root
			variant="secondary"
			disabled={!draft.compiled.ok || !draft.sample.ok}
			onclick={sendTest}
		>
			<Icon.Root icon="lucide:send" />
			Send test
		</Button.Root>

		<Button.Root disabled={!draft.changed || !draft.compiled.ok} onclick={save}>
			<Icon.Root icon="lucide:save" />
			Save
		</Button.Root>

		<RowActions.Root label="Template actions">
			{#if draft.editor === 'visual'}
				<RowActions.Item icon="lucide:code-xml" onSelect={editAsHtml}>Edit as HTML</RowActions.Item>
			{/if}

			{#if template.system}
				<RowActions.Item
					variant="danger"
					icon="lucide:rotate-ccw"
					disabled={!template.customized}
					onSelect={() => void dialogs.open(ResetTemplateDialog, { name: template.name })}
				>
					Reset to default
				</RowActions.Item>
			{:else}
				<RowActions.Item
					variant="danger"
					icon="lucide:trash-2"
					onSelect={() => void dialogs.open(DeleteTemplateDialog, { name: template.name })}
				>
					Delete
				</RowActions.Item>
			{/if}
		</RowActions.Root>
	</div>

	{#if draft.failure}
		<Callout.Root variant="error">
			<Callout.Icon><Icon.Root icon="lucide:circle-alert" /></Callout.Icon>
			<Callout.Body>
				<Callout.Title>Not saved</Callout.Title>
				<Callout.Description>{draft.failure}</Callout.Description>
			</Callout.Body>
		</Callout.Root>
	{/if}

	<TemplateFields {draft} system={template.system} />

	{#if !draft.compiled.ok}
		<Callout.Root variant="error">
			<Callout.Icon><Icon.Root icon="lucide:circle-alert" /></Callout.Icon>
			<Callout.Body>
				<Callout.Title>Fix the variable tags</Callout.Title>
				<Callout.Description>
					<ul class="flex flex-col gap-1">
						{#each draft.compiled.problems as problem, index (index)}
							<li>
								{problem.source === 'subject' ? 'Subject' : 'Email'}{draft.editor === 'html' &&
								problem.source === 'body'
									? `, line ${problem.line}`
									: ''}: {problem.message}
							</li>
						{/each}
					</ul>
				</Callout.Description>
			</Callout.Body>
		</Callout.Root>
	{/if}

	<div class="flex flex-wrap items-center justify-between gap-2">
		<Segmented.Root
			value={draft.tab}
			onValueChange={(next) => (draft.tab = next)}
			aria-label="Template"
		>
			{#each tabs as item (item.value)}
				<Segmented.Item value={item.value}>
					<Icon.Root icon={item.icon} />
					{item.label}
				</Segmented.Item>
			{/each}
		</Segmented.Root>

		{#if draft.tab === 'preview'}
			<TemplateWidthToggle {draft} />
		{/if}
	</div>

	{#if draft.tab === 'design'}
		<TemplateDesignTab {draft} {from} />
	{:else if draft.tab === 'preview'}
		<TemplatePreviewTab {draft} {from} />
	{:else if draft.tab === 'data'}
		<TemplateDataTab {draft} system={template.system} />
	{:else}
		<Card.Root>
			<Card.Content class="pt-6">
				<TemplateUsage name={template.name} sampleData={draft.sampleData} />
			</Card.Content>
		</Card.Root>
	{/if}
</div>
