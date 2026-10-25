<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';

	import Star from '../../components/star.svelte';
	import { MAX_RATING, RATING_LABELS, RATINGS } from '../../lib/rating.js';

	let { field, name, value, required, disabled, id, errorId }: FieldInputProps<number> = $props();

	// Starts at the record's value; the hidden input below submits it with the record form.
	let current = $derived(value ?? 0);
	// The star under the pointer, which previews that rating.
	let hovered = $state<number | null>(null);

	const shown = $derived(hovered ?? current);

	function choose(rating: number) {
		// Choosing the current rating again clears it.
		current = current === rating ? 0 : rating;
	}

	// Arrow keys move the rating, like a group of radio buttons.
	function onkeydown(event: KeyboardEvent) {
		const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];

		if (step === undefined) {
			return;
		}

		event.preventDefault();
		current = Math.min(MAX_RATING, Math.max(1, current + step));
		(event.currentTarget as HTMLElement)
			.querySelector<HTMLButtonElement>(`[data-rating="${current}"]`)
			?.focus();
	}
</script>

<input type="hidden" {name} value={current || ''} {required} />

<div class="flex items-center gap-3">
	<div
		role="radiogroup"
		aria-label={field.name}
		aria-describedby={errorId}
		tabindex="-1"
		class={['flex items-center', disabled && 'opacity-50']}
		onmouseleave={() => (hovered = null)}
		{onkeydown}
	>
		{#each RATINGS as rating (rating)}
			<button
				type="button"
				role="radio"
				id={rating === (current || 1) ? id : undefined}
				data-rating={rating}
				aria-checked={current === rating}
				aria-label={`${rating} of ${MAX_RATING}: ${RATING_LABELS[rating - 1]}`}
				tabindex={rating === (current || 1) ? 0 : -1}
				{disabled}
				class="cursor-pointer rounded-md p-0.5 transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:hover:scale-100"
				onmouseenter={() => (hovered = disabled ? null : rating)}
				onclick={() => choose(rating)}
			>
				<Star filled={rating <= shown} class="size-6" />
			</button>
		{/each}
	</div>

	<span class="text-sm text-zinc-500 tabular-nums" aria-live="polite">
		{#if shown}
			<span class="font-medium text-zinc-900">{RATING_LABELS[shown - 1]}</span>
			· {shown} of {MAX_RATING}
		{:else}
			Not rated
		{/if}
	</span>
</div>
