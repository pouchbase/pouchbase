<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Logo from '#lib/components/ui/logo/index.js';
	import ErrorView from './error-view.svelte';
</script>

<!-- Errors outside the dashboard (login, install) and of the dashboard layout itself. -->
<main class="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-8 px-4 py-12">
	<a
		href={resolve('/')}
		class="flex items-center gap-2 self-start text-sm font-semibold text-zinc-900"
	>
		<Logo.Root alt="" />
		Pouchbase
	</a>

	<ErrorView />
</main>
