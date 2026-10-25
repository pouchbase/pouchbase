<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';

	import { DEFAULT_COLOR, normalizeColor, PRESETS } from '../../lib/color.js';

	let { field, name, value, required, disabled, id, errorId }: FieldInputProps<string> = $props();

	// The hex digits without `#`, which the control shows in front; the server adds it back.
	let hex = $derived((value ?? '').replace(/^#/, ''));

	const color = $derived(normalizeColor(hex));
	const invalid = $derived(hex !== '' && color === null);
</script>

<div class="flex flex-col gap-2.5">
	<div
		class={[
			'flex h-control items-center rounded-md border bg-white pl-1 shadow-xs transition-shadow focus-within:ring-2',
			invalid
				? 'border-red-500 ring-2 ring-red-500/10'
				: 'border-zinc-300 focus-within:border-zinc-900 focus-within:ring-zinc-900/10',
			disabled && 'cursor-not-allowed opacity-50'
		]}
	>
		<!-- The swatch opens the browser's color picker, which sits invisibly on top of it. -->
		<label
			class={[
				'relative size-6 flex-none cursor-pointer overflow-hidden rounded inset-ring inset-ring-black/10',
				// No valid color yet: a checkerboard, like an empty layer in an image editor.
				color === null &&
					'bg-[repeating-conic-gradient(var(--color-zinc-200)_0_25%,white_0_50%)] bg-size-[8px_8px]'
			]}
			style:background-color={color}
		>
			<input
				type="color"
				class="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
				value={color ?? DEFAULT_COLOR}
				oninput={(event) => (hex = event.currentTarget.value.slice(1))}
				aria-label={`Pick ${field.name}`}
				{disabled}
			/>
		</label>

		<span class="pr-0.5 pl-2 font-mono text-sm text-zinc-400" aria-hidden="true">#</span>

		<input
			class="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-sm tracking-wider text-zinc-900 uppercase outline-none placeholder:text-zinc-300 disabled:cursor-not-allowed"
			{id}
			{name}
			bind:value={hex}
			{required}
			{disabled}
			maxlength={7}
			placeholder="FF8800"
			spellcheck="false"
			autocomplete="off"
			aria-invalid={invalid || undefined}
			aria-describedby={errorId}
		/>
	</div>

	<div class="flex flex-wrap gap-1.5" role="group" aria-label="Preset colors">
		{#each PRESETS as preset (preset.value)}
			<button
				type="button"
				class={[
					'size-5 cursor-pointer rounded-full inset-ring inset-ring-black/10 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100',
					color === preset.value && 'outline-2 outline-offset-2'
				]}
				style:background-color={preset.value}
				style:outline-color={color === preset.value ? preset.value : undefined}
				title={preset.name}
				aria-label={preset.name}
				aria-pressed={color === preset.value}
				{disabled}
				onclick={() => (hex = preset.value.slice(1))}
			></button>
		{/each}
	</div>
</div>
