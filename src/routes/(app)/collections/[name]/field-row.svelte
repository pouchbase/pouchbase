<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Sortable from '#lib/components/ui/sortable/index.js';
	import { fieldTypeInfo } from '#lib/fields/field-type-info.js';
	import { canHide, isAutoType } from '#lib/fields/field-types.js';
	import { describeField } from './field-summary.js';
	import type { updateFields } from './fields.remote';
	import type { GridField, PluginType } from './grid';

	type Props = {
		/** The fields form; the row binds its inputs to `fields[index]`. */
		form: ReturnType<typeof updateFields.for>;
		index: number;
		field: GridField;
		/** The row's current state in the form. */
		row: { id: string; remove: boolean };
		pluginTypes: PluginType[] | undefined;
		onEditSettings: (field: GridField) => void;
		onEditComputation: (field: GridField) => void;
	};

	let { form, index, field, row, pluginTypes, onEditSettings, onEditComputation }: Props = $props();

	const entry = $derived(form.fields.fields[index]);
	const type = $derived(fieldTypeInfo(field, pluginTypes));
	const locked = $derived(field.system || row.remove);
	const auto = $derived(isAutoType(field.type));
	const canRequire = $derived(field.type !== 'computed' && !auto);
	const canBeUnique = $derived(
		field.type !== 'file' &&
			!auto &&
			!((field.type === 'relation' || field.type === 'list') && field.options.multiple)
	);
	/** Fields with settings for the edit-field dialog; timestamps have none. */
	const hasSettings = $derived(
		!field.system &&
			!type.orphaned &&
			field.type !== 'computed' &&
			field.type !== 'created' &&
			field.type !== 'updated' &&
			field.type !== 'blob'
	);
</script>

<Sortable.Item {index} variant={row.remove ? 'danger' : 'default'}>
	<Form.Hidden field={entry.id} value={row.id} />
	<Form.Hidden field={entry.remove} value={row.remove} />

	<Sortable.Handle aria-label="Move {field.name}" />
	<Sortable.Icon title={type.label}>
		<Icon.Root icon={type.icon} src={type.iconUrl} />
	</Sortable.Icon>

	<div class="flex min-w-0 flex-1 flex-col">
		<Form.Field field={entry.name} class="gap-0">
			<Form.Label class="sr-only">Name of {field.name}</Form.Label>
			<Form.Input
				variant="ghost"
				defaultValue={field.name}
				readonly={locked}
				autocomplete="off"
				class={['-ml-2 h-7 px-2 font-mono font-medium', row.remove && 'text-zinc-500 line-through']}
			/>
			<Form.Errors class="text-xs" />
		</Form.Field>

		{#if row.remove && field.type === 'id'}
			<span class="text-xs text-red-600">
				Deleted with its values when you save; records are then identified by their row number
			</span>
		{:else if row.remove}
			<span class="text-xs text-red-600">Deleted with its data when you save</span>
		{:else}
			<span class="truncate text-xs text-zinc-500">{describeField(field, pluginTypes)}</span>
		{/if}
	</div>

	<div class="flex w-16 justify-center">
		{#if canRequire}
			<Form.Field field={entry.required} orientation="horizontal">
				<Form.Checkbox defaultChecked={field.required} disabled={locked} />
				<Form.Label class="sr-only">{field.name} is required</Form.Label>
			</Form.Field>
		{:else}
			<span class="text-zinc-300" title="Always filled in automatically">—</span>
		{/if}
	</div>

	<div class="flex w-16 justify-center">
		{#if canBeUnique}
			<Form.Field field={entry.unique} orientation="horizontal">
				<Form.Checkbox defaultChecked={field.unique} disabled={locked} />
				<Form.Label class="sr-only">{field.name} is unique</Form.Label>
			</Form.Field>
		{:else}
			<span class="text-zinc-300" title="Not available for this field type">—</span>
		{/if}
	</div>

	<div class="flex w-16 justify-center">
		{#if canHide(field)}
			<Form.Field field={entry.hidden} orientation="horizontal">
				<Form.Checkbox defaultChecked={field.hidden} disabled={locked} />
				<Form.Label class="sr-only">{field.name} is hidden from app users</Form.Label>
			</Form.Field>
		{:else}
			<span class="text-zinc-300" title="The ID and built-in fields are always shown">—</span>
		{/if}
	</div>

	<div class="flex w-16 shrink-0 justify-end">
		{#if hasSettings && !row.remove}
			<Button.Root
				variant="ghost"
				size="icon"
				aria-label="Edit settings of {field.name}"
				title="Edit settings"
				class="text-zinc-400 hover:text-zinc-900"
				onclick={() => onEditSettings(field)}
			>
				<Icon.Root icon="lucide:settings-2" />
			</Button.Root>
		{/if}

		{#if field.type === 'computed' && !row.remove}
			<Button.Root
				variant="ghost"
				size="icon"
				aria-label="Edit computation of {field.name}"
				title="Edit computation"
				class="text-zinc-400 hover:text-zinc-900"
				onclick={() => onEditComputation(field)}
			>
				<Icon.Root icon="lucide:square-function" />
			</Button.Root>
		{/if}

		{#if field.system}
			<span class="flex size-8 shrink-0 items-center justify-center text-zinc-400">
				<Icon.Root icon="lucide:lock" label="Built-in field" class="size-3.5" />
			</span>
		{:else if row.remove}
			<Button.Root
				variant="ghost"
				size="icon"
				aria-label="Keep {field.name}"
				title="Keep"
				onclick={() => entry.remove.set(false)}
			>
				<Icon.Root icon="lucide:undo-2" />
			</Button.Root>
		{:else}
			<!-- Shown on hover or focus, and always on touch screens. -->
			<Button.Root
				variant="ghost"
				size="icon"
				aria-label="Delete {field.name}"
				title="Delete"
				class="text-zinc-400 opacity-0 group-hover/item:opacity-100 hover:text-red-600 focus-visible:opacity-100 pointer-coarse:opacity-100"
				onclick={() => entry.remove.set(true)}
			>
				<Icon.Root icon="lucide:trash-2" />
			</Button.Root>
		{/if}
	</div>
</Sortable.Item>
