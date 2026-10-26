<script lang="ts">
	import * as Input from '@pouchbasejs/ui/inputs/input';
</script>

<div class="grid max-w-sm gap-3">
	<div class="flex flex-col gap-1.5">
		<Input.Root
			type="email"
			value="ada@"
			aria-label="Email"
			aria-invalid="true"
			aria-describedby="email-error"
		/>
		<p id="email-error" class="text-xs text-red-600">Enter a valid email address.</p>
	</div>
	<Input.Root value="Disabled" aria-label="Disabled" disabled />
	<Input.Root value="k3x9a2" aria-label="Id" readonly class="font-mono" />
	<Input.Root variant="ghost" value="Edit me in place" aria-label="Title" />
</div>
