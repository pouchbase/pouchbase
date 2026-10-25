<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as ErrorState from '#lib/components/ui/error-state/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { statusText } from '#lib/errors.js';

	// Shown inside the layout, so the header and footer stay and people can navigate on.
	const status = $derived(page.status);
	const text = $derived(statusText(status));
	const message = $derived(
		page.error?.message && page.error.message !== text.title ? page.error.message : null
	);
	const login = $derived(
		`${resolve('/account/login')}?redirectTo=${encodeURIComponent(page.url.pathname + page.url.search)}`
	);
</script>

<svelte:head>
	<title>{text.title} · Pouchbase</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="flex min-h-[70svh] items-center px-6 py-24">
	<ErrorState.Root>
		<ErrorState.Status {status} />
		<ErrorState.Title>{text.title}</ErrorState.Title>

		{#if message}
			<ErrorState.Description class="font-medium text-zinc-900">{message}</ErrorState.Description>
		{/if}

		<ErrorState.Description>{text.description}</ErrorState.Description>

		<ErrorState.Details reason={page.error?.reason} id={page.error?.id} />

		<ErrorState.Actions>
			{#if status === 401}
				<Button.Root variant="brand" href={login}>
					<Icon.Root icon="lucide:log-in" />
					Sign in
				</Button.Root>
			{:else if status >= 500}
				<Button.Root variant="brand" onclick={() => location.reload()}>
					<Icon.Root icon="lucide:refresh-cw" />
					Try again
				</Button.Root>
			{/if}

			<Button.Root
				variant={status === 401 || status >= 500 ? 'secondary' : 'brand'}
				href={resolve('/')}
			>
				<Icon.Root icon="lucide:house" />
				Home
			</Button.Root>

			{#if status === 404}
				<Button.Root variant="secondary" href={resolve('/docs')}>
					<Icon.Root icon="lucide:book-open" />
					Docs
				</Button.Root>
				<Button.Root variant="secondary" href={resolve('/plugins')}>
					<Icon.Root icon="lucide:puzzle" />
					Plugins
				</Button.Root>
			{/if}
		</ErrorState.Actions>
	</ErrorState.Root>
</section>
