<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { parseTheme, theme } from '#lib/theme.svelte.js';
</script>

<!-- Switches between light, dark and the system's colour scheme. -->
<DropdownMenu.Root>
	<DropdownMenu.Trigger variant="ghost" size="icon" aria-label="Theme">
		<Icon.Root icon="lucide:sun-moon" />
	</DropdownMenu.Trigger>

	<DropdownMenu.Content side="top" align="end">
		<DropdownMenu.RadioGroup
			bind:value={() => theme.preference, (value) => (theme.preference = parseTheme(value))}
		>
			<DropdownMenu.RadioItem value="light">
				<Icon.Root icon="lucide:sun" />
				Light
			</DropdownMenu.RadioItem>

			<DropdownMenu.RadioItem value="dark">
				<Icon.Root icon="lucide:moon" />
				Dark
			</DropdownMenu.RadioItem>

			<DropdownMenu.RadioItem value="system">
				<Icon.Root icon="lucide:monitor" />
				System
			</DropdownMenu.RadioItem>
		</DropdownMenu.RadioGroup>
	</DropdownMenu.Content>
</DropdownMenu.Root>
