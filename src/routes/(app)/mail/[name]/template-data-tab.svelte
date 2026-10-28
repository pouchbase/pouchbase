<script lang="ts">
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as Code from '#lib/components/ui/inputs/code/index.js';
	import type { TemplateDraft } from './template-draft.svelte';

	type Props = {
		draft: TemplateDraft;
		/** Built-in templates get their variables from Pouchbase. */
		system: boolean;
	};

	let { draft, system }: Props = $props();
</script>

<Card.Root>
	<Card.Content class="flex flex-col gap-4 pt-6">
		<Field.Root>
			<Field.Label id="mail-sample-label">Sample data</Field.Label>
			<Code.Root
				bind:value={draft.sampleText}
				language="json"
				lineNumbers={false}
				aria-labelledby="mail-sample-label"
				aria-invalid={!draft.sample.ok}
				class="h-72"
			/>
			<Field.Description>
				{#if system}
					The variables Pouchbase passes when it sends this email, for the preview.
				{:else}
					A JSON object with example variables, for the preview and test emails.
				{/if}
			</Field.Description>
		</Field.Root>

		{#if draft.compiled.ok && draft.compiled.variables.length}
			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium text-zinc-900">Variables in this template</span>
				<div class="flex flex-wrap gap-2">
					{#each draft.compiled.variables as variable (variable.name)}
						<Badge.Root variant={draft.missing.includes(variable.name) ? 'danger' : 'outline'}>
							<span class="font-mono">{variable.name}</span>
							{variable.required ? 'required' : 'optional'}
						</Badge.Root>
					{/each}
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
