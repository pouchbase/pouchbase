<script lang="ts">
	import { page } from '$app/state';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as ErrorState from '#lib/components/ui/error-state/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { statusText } from '#lib/errors.js';

	// The error page of the root layout and of the dashboard: what went wrong and what to do now.
	const status = $derived(page.status);
	const text = $derived(statusText(status));
	const error = $derived(page.error);
	const message = $derived(error?.message && error.message !== text.title ? error.message : null);
</script>

<svelte:head>
	<title>{text.title} · Pouchbase</title>
</svelte:head>

<ErrorState.Root>
	<ErrorState.Icon variant={status >= 500 ? 'error' : 'neutral'}>
		{#if status === 404}
			<Icon.Root icon="lucide:file-question" />
		{:else if status === 401 || status === 403}
			<Icon.Root icon="lucide:lock" />
		{:else if status === 502 || status === 503}
			<Icon.Root icon="lucide:cloud-off" />
		{:else}
			<Icon.Root icon="lucide:circle-alert" />
		{/if}
	</ErrorState.Icon>

	<ErrorState.Status {status} />
	<ErrorState.Title>{text.title}</ErrorState.Title>

	{#if message}
		<ErrorState.Description class="font-medium text-zinc-900">{message}</ErrorState.Description>
	{/if}

	<ErrorState.Description>{text.description}</ErrorState.Description>

	<ErrorState.Details reason={error?.reason} code={error?.code} id={error?.id} />

	<ErrorState.Actions>
		{#if status === 401}
			<Button.Root href="/login">
				<Icon.Root icon="lucide:log-in" />
				Log in
			</Button.Root>
		{:else if status === 404}
			<Button.Root href="/">
				<Icon.Root icon="lucide:house" />
				Go to the dashboard
			</Button.Root>
		{:else}
			<Button.Root onclick={() => location.reload()}>
				<Icon.Root icon="lucide:refresh-cw" />
				Try again
			</Button.Root>
			<Button.Root variant="secondary" href="/">
				<Icon.Root icon="lucide:house" />
				Go to the dashboard
			</Button.Root>
		{/if}
	</ErrorState.Actions>
</ErrorState.Root>
