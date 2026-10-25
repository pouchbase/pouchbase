<script module lang="ts">
	export type Item = {
		value: string;
		label: string;
		/** Shown under the label in the list. */
		description?: string;
		/** Iconify name; literal so the icon bundler can find it. */
		icon?: string;
		/**
		 * URL of an SVG icon, drawn in one color like `icon` (`Icon.Root src`), e.g. a plugin's icon;
		 * wins over `icon`.
		 */
		iconSrc?: string | null;
		/** Image URL shown as a thumbnail before the label; falls back to `icon` when it fails to load. */
		image?: string;
		disabled?: boolean;
		/**
		 * Heading of the group the item is listed under. Items of a group follow each other;
		 * items without one are listed without a heading.
		 */
		group?: string;
	};

	export type Props = {
		items: Item[];
		value?: string;
		/** Name of the hidden input, so the value is submitted with a form. */
		name?: string;
		placeholder?: string;
		id?: string;
		disabled?: boolean;
		class?: string;
		onValueChange?: (value: string) => void;
		'aria-invalid'?: boolean | 'true' | 'false';
		'aria-describedby'?: string;
		'aria-labelledby'?: string;
		/** For a select without a visible label. */
		'aria-label'?: string;
	};
</script>

<script lang="ts">
	import { Select } from 'bits-ui';
	import * as Icon from '../../icon/index.js';
	import * as ScrollArea from '../../scroll-area/index.js';
	import * as Thumbnail from '../../thumbnail/index.js';

	let {
		items,
		value = $bindable(''),
		name,
		placeholder = 'Select…',
		id,
		disabled = false,
		class: className,
		onValueChange,
		...aria
	}: Props = $props();

	const selected = $derived(items.find((item) => item.value === value));

	// Consecutive items with the same `group` share a heading.
	const groups = $derived(
		items.reduce<{ key: string; label?: string; items: Item[] }[]>((list, item) => {
			const last = list.at(-1);

			if (last && last.label === item.group) {
				last.items.push(item);
			} else {
				list.push({ key: `${list.length}:${item.group ?? ''}`, label: item.group, items: [item] });
			}

			return list;
		}, [])
	);
</script>

{#snippet option(item: Item)}
	<Select.Item
		value={item.value}
		label={item.label}
		disabled={item.disabled}
		class="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-700 outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-zinc-100 data-highlighted:text-zinc-900"
	>
		{#snippet children({ selected: isSelected })}
			{#if item.image}
				<Thumbnail.Root src={item.image} size="md">
					{#if item.icon}
						<Icon.Root icon={item.icon} />
					{/if}
				</Thumbnail.Root>
			{:else if item.icon || item.iconSrc}
				<Icon.Root icon={item.icon} src={item.iconSrc} class="size-4 text-zinc-500" />
			{/if}

			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate">{item.label}</span>

				{#if item.description}
					<span class="truncate text-xs text-zinc-500">{item.description}</span>
				{/if}
			</span>

			{#if isSelected}
				<Icon.Root icon="lucide:check" class="size-4 text-zinc-900" />
			{/if}
		{/snippet}
	</Select.Item>
{/snippet}

<Select.Root
	type="single"
	bind:value
	{name}
	{disabled}
	items={items.map(({ value, label, disabled }) => ({ value, label, disabled }))}
	{onValueChange}
>
	<Select.Trigger
		{id}
		{...aria}
		class={[
			'flex h-control w-full cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-left text-sm text-zinc-900 shadow-xs outline-none focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-red-500/10 data-[state=open]:border-zinc-900',
			className
		]}
	>
		{#if selected && (selected.icon || selected.iconSrc) && !selected.image}
			<Icon.Root icon={selected.icon} src={selected.iconSrc} class="size-4 text-zinc-500" />
		{/if}

		<span class={['flex-1 truncate', !selected && 'text-zinc-400']}>
			{selected?.label ?? placeholder}
		</span>

		<Icon.Root icon="lucide:chevrons-up-down" class="size-4 text-zinc-500" />
	</Select.Trigger>

	<Select.Portal>
		<Select.Content
			sideOffset={4}
			class="z-50 max-h-(--bits-select-content-available-height) w-(--bits-select-anchor-width) min-w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg outline-none"
		>
			<!-- At most 18rem high, so long lists scroll instead of filling the screen. -->
			<ScrollArea.Root
				type="auto"
				viewportClass="max-h-[min(18rem,calc(var(--bits-select-content-available-height)-2px))]"
			>
				<Select.Viewport class="p-1.5">
					{#each groups as group (group.key)}
						{#if group.label}
							<Select.Group>
								<Select.GroupHeading class="px-3 pt-2 pb-1 text-xs font-medium text-zinc-500">
									{group.label}
								</Select.GroupHeading>

								{#each group.items as item (item.value)}
									{@render option(item)}
								{/each}
							</Select.Group>
						{:else}
							{#each group.items as item (item.value)}
								{@render option(item)}
							{/each}
						{/if}
					{/each}
				</Select.Viewport>
			</ScrollArea.Root>
		</Select.Content>
	</Select.Portal>
</Select.Root>
