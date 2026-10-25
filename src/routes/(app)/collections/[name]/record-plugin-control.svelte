<script lang="ts">
	import { getFieldContext } from '#lib/components/ui/form/form-context.js';
	import * as PluginComponent from '#lib/components/ui/plugin-component/index.js';
	import { pluginFieldInfo, pluginRef, type GridField, type PluginType } from './grid';

	type Props = {
		field: GridField;
		/** The installed type of the field. */
		pluginType: PluginType;
		/** Current value; `null` for an empty value. */
		value: unknown;
		disabled?: boolean;
	};

	let { field, pluginType, value, disabled = false }: Props = $props();

	const ctx = getFieldContext();
	const invalid = $derived(!!ctx.field.issues()?.length);
	// The name the record form submits the value under (`values.<field>`).
	const name = $derived(ctx.field.as('text').name);
</script>

<!--
	The plugin's input component, inside a `Form.Field`: it renders a control (often a hidden
	input) with `name`, which the record form submits. When it can't load, nothing is submitted
	for the field, so saving keeps the stored value.
-->
<PluginComponent.Root
	plugin={pluginRef(pluginType)}
	path={pluginType.input}
	props={{
		field: pluginFieldInfo(field),
		name,
		value: value ?? null,
		required: field.required,
		disabled,
		id: ctx.id,
		errorId: invalid ? `${ctx.id}-errors` : undefined
	}}
/>
