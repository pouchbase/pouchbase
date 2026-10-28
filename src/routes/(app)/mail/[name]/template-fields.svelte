<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as Input from '#lib/components/ui/inputs/input/index.js';
	import { parseTemplate } from '#lib/mail/template.js';
	import type { TemplateDraft } from './template-draft.svelte';

	type Props = {
		draft: TemplateDraft;
		/** Built-in templates have no description. */
		system: boolean;
	};

	let { draft, system }: Props = $props();

	function problemOf(source: string) {
		const parsed = parseTemplate(source);

		return parsed.ok ? null : parsed.problems[0].message;
	}

	const subjectProblem = $derived(problemOf(draft.subject));
	const preheaderProblem = $derived(problemOf(draft.preheader));
</script>

<Card.Root>
	<Card.Content class="grid gap-4 pt-6 md:grid-cols-2">
		<Field.Root>
			<Field.Label for="mail-subject">Subject</Field.Label>
			<Input.Root
				id="mail-subject"
				bind:value={draft.subject}
				autocomplete="off"
				aria-invalid={!!subjectProblem}
				aria-describedby={subjectProblem ? 'mail-subject-problem' : undefined}
			/>
			{#if subjectProblem}
				<Field.Description id="mail-subject-problem" class="text-red-600">
					{subjectProblem}
				</Field.Description>
			{/if}
		</Field.Root>

		{#if draft.editor === 'visual'}
			<Field.Root>
				<Field.Label for="mail-preheader">Preview text</Field.Label>
				<Input.Root
					id="mail-preheader"
					bind:value={draft.preheader}
					autocomplete="off"
					placeholder="Shown next to the subject in the inbox"
					aria-invalid={!!preheaderProblem}
					aria-describedby={preheaderProblem ? 'mail-preheader-problem' : undefined}
				/>
				{#if preheaderProblem}
					<Field.Description id="mail-preheader-problem" class="text-red-600">
						{preheaderProblem}
					</Field.Description>
				{/if}
			</Field.Root>
		{/if}

		{#if !system}
			<Field.Root class="md:col-span-2">
				<Field.Label for="mail-description">Description</Field.Label>
				<Input.Root
					id="mail-description"
					bind:value={draft.description}
					autocomplete="off"
					placeholder="What the email is for"
				/>
			</Field.Root>
		{/if}
	</Card.Content>
</Card.Root>
