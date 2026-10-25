<script lang="ts">
	import type { Check } from '../lib/check.js';

	import * as Badge from '@pouchbasejs/ui/badge';
	import * as Button from '@pouchbasejs/ui/button';
	import * as Card from '@pouchbasejs/ui/card';
	import * as Checkbox from '@pouchbasejs/ui/inputs/checkbox';
	import * as Icon from '@pouchbasejs/ui/icon';

	import { FIELD_TYPES, type FieldTypeId } from '../lib/catalog.js';
	import { checkColor } from '../lib/color.js';
	import { checkPhone } from '../lib/phone.js';
	import { checkRating } from '../lib/rating.js';
	import FieldInput from './field-input.svelte';
	import FieldPreview from './field-preview.svelte';

	let { type }: { type: FieldTypeId } = $props();

	const info = $derived(FIELD_TYPES[type]);
	const name = $derived(`playground_${type}`);
	const id = $derived(`playground-${type}`);

	// The same checks as the field types' `validate` and `serialize` on the server.
	const checks: Record<FieldTypeId, (value: unknown) => Check<string | number>> = {
		color: checkColor,
		phone: checkPhone,
		rating: checkRating
	};

	let form: HTMLFormElement | undefined;
	let disabled = $state(false);
	// Bumped by Reset, which renders the input again with the sample value.
	let resets = $state(0);
	// What the record form would submit for the field: the value of the control named `name`.
	let submitted = $state('');

	const check = $derived(submitted === '' ? null : checks[type](submitted));

	// Inputs update their controls after the event that changed them, so read on the next tick.
	function read() {
		setTimeout(() => {
			submitted = form ? String(new FormData(form).get(name) ?? '') : '';
		});
	}

	/**
	 * Reads the value after anything the admin does. Listens on the document, because some inputs
	 * open their options outside the form, e.g. the phone input's list of countries.
	 */
	function watch(element: HTMLFormElement) {
		const events = ['input', 'change', 'click', 'keyup'];

		form = element;
		read();

		for (const event of events) {
			document.addEventListener(event, read);
		}

		return () => {
			for (const event of events) {
				document.removeEventListener(event, read);
			}
		};
	}

	function reset() {
		resets += 1;
		read();
	}
</script>

<Card.Root>
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-100 px-5 py-4">
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<div class="flex items-center gap-2">
				<h2 class="text-sm font-semibold text-zinc-900">{info.label}</h2>
				<code class="font-mono text-xs text-zinc-400">demo:{type}</code>
				<Badge.Root variant="outline">{info.column}</Badge.Root>
			</div>
			<p class="text-sm text-zinc-500">{info.description}</p>
		</div>

		<label class="flex items-center gap-2 text-sm text-zinc-600">
			<Checkbox.Root bind:checked={disabled} />
			Disabled
		</label>
		<Button.Root variant="ghost" onclick={reset}>
			<Icon.Root icon="lucide:rotate-ccw" />
			Reset
		</Button.Root>
	</div>

	<div class="@container">
		<div class="grid gap-5 p-5 @2xl:grid-cols-2">
			<div class="flex flex-col gap-2">
				<label for={id} class="text-xs font-medium tracking-wide text-zinc-500 uppercase">
					Input · record form
				</label>

				<form {@attach watch} onsubmit={(event) => event.preventDefault()}>
					{#key resets}
						<FieldInput {type} {name} {id} value={info.samples[0] ?? null} {disabled} />
					{/key}
				</form>
			</div>

			<div class="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
				<div class="flex flex-col gap-1.5">
					<span class="text-xs font-medium tracking-wide text-zinc-500 uppercase">
						Preview · records grid
					</span>
					<div class="flex min-h-6 items-center">
						{#if check?.valid}
							<FieldPreview {type} value={check.stored} />
						{:else}
							<span class="text-sm text-zinc-400 italic">Nothing to show</span>
						{/if}
					</div>
				</div>

				<dl class="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
					<dt class="text-zinc-500">Submitted</dt>
					<dd class="truncate font-mono text-xs text-zinc-700">
						{submitted === '' ? '—' : JSON.stringify(submitted)}
					</dd>
					<dt class="text-zinc-500">Stored</dt>
					<dd class="truncate font-mono text-xs text-zinc-900">
						{check?.valid ? JSON.stringify(check.stored) : '—'}
					</dd>
				</dl>

				{#if check && !check.valid}
					<p class="flex items-start gap-2 text-sm text-red-700">
						<Icon.Root icon="lucide:circle-alert" class="mt-0.5 size-4" />
						{check.message}
					</p>
				{:else if check}
					<p class="flex items-center gap-2 text-sm text-emerald-700">
						<Icon.Root icon="lucide:circle-check" class="size-4" />
						Valid: Pouchbase stores it as shown
					</p>
				{/if}
			</div>
		</div>
	</div>
</Card.Root>
