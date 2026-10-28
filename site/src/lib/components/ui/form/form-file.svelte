<script lang="ts">
	import * as File from '@pouchbasejs/ui/inputs/file';
	import { getFieldContext } from './form-context';

	type Props = Omit<File.RootProps, 'name' | 'id' | 'files' | 'multiple'>;

	let { ...rest }: Props = $props();

	const ctx = getFieldContext();
	const invalid = $derived(!!ctx.field.issues()?.length);
</script>

<!-- The surrounding `Form.Root` needs `enctype="multipart/form-data"`. -->
<File.Root
	{...ctx.field.as('file')}
	id={ctx.id}
	aria-describedby={invalid ? `${ctx.id}-errors` : undefined}
	{...rest}
/>
