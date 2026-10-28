<script lang="ts" module>
	import type { AnyRemoteFormField } from '../form/form-context';

	/** A hidden input sent with the confirmation, e.g. the id of the item to delete. */
	export interface HiddenField {
		field: AnyRemoteFormField;
		value: string | boolean;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Button from '../button/index.js';
	import * as Dialog from '../dialog/index.js';
	import * as Form from '../form/index.js';
	import type { AnyRemoteForm } from '../form/form-context';

	type Props = {
		/** Remote form that performs the action, usually a keyed instance (`myForm.for(id)`). */
		form: AnyRemoteForm;
		title: string;
		/** Explains what happens; rendered inside `Dialog.Description`. */
		description: Snippet;
		/** Label of the submit button, e.g. `Delete key`. */
		submit: string;
		/** Toast shown when the action succeeded. */
		success: string;
		hidden?: HiddenField[];
		variant?: Button.Variant;
		/**
		 * Called after a successful submit, usually the dialog's `close`. Leave it out when the
		 * server redirects and the form should keep SvelteKit's default handling.
		 */
		close?: () => void;
		/**
		 * The action redirects: call `close` once the submit has finished, whatever its result,
		 * because a redirect doesn't count as a successful submit.
		 */
		redirects?: boolean;
	};

	let {
		form,
		title,
		description,
		submit,
		success,
		hidden = [],
		variant = 'danger',
		close,
		redirects = false
	}: Props = $props();
</script>

<Dialog.Content>
	<Dialog.Header>
		<Dialog.Title>{title}</Dialog.Title>
		<Dialog.Description>
			{@render description()}
		</Dialog.Description>
	</Dialog.Header>

	<Form.Root
		{form}
		{success}
		enhance={close
			? async (instance) => {
					const succeeded = await instance.submit();

					if (succeeded || redirects) {
						close();
					}
				}
			: undefined}
	>
		{#each hidden as { field, value }, index (index)}
			<Form.Hidden {field} {value} />
		{/each}

		<Dialog.Footer>
			<Dialog.Close>Cancel</Dialog.Close>
			<Form.Submit {variant}>{submit}</Form.Submit>
		</Dialog.Footer>
	</Form.Root>
</Dialog.Content>
