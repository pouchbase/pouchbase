<script lang="ts">
	import { DropdownMenu } from 'bits-ui';

	let {
		value = $bindable(''),
		ref = $bindable(null),
		class: className,
		...rest
	}: DropdownMenu.RadioGroupProps = $props();
</script>

<DropdownMenu.RadioGroup
	bind:value
	bind:ref
	{...rest}
	class={['flex flex-col gap-0.5', className]}
/>
