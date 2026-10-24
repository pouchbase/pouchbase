<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';

	type Props = {
		/** What the section shows, for the error: `Your plugins could not be loaded`. */
		title: string;
		children: Snippet;
	};

	let { title, children }: Props = $props();

	function describe(error: unknown): { message?: string; reason?: string } {
		// An `HttpError` (`{ status, body }`), or the `App.Error` itself once SvelteKit handled it.
		type Body = { message?: unknown; reason?: unknown };
		const body = (error as { body?: Body } | null)?.body ?? (error as Body | null);

		return {
			message: typeof body?.message === 'string' ? body.message : undefined,
			reason: typeof body?.reason === 'string' ? body.reason : undefined
		};
	}
</script>

<!-- A section of the account page that fails on its own, so the rest of the page keeps working. -->
<svelte:boundary>
	{@render children()}

	{#snippet failed(error, reset)}
		{@const { message, reason } = describe(error)}
		<Callout.Root variant="error">
			<Callout.Icon><Icon.Root icon="lucide:circle-x" /></Callout.Icon>
			<Callout.Body>
				<Callout.Title>{title}</Callout.Title>
				<!-- The title already says what failed; the reason says why, when there is one. -->
				<Callout.Description>
					{reason ? `${reason}.` : (message ?? 'Something went wrong.')}
				</Callout.Description>
				<div class="pt-1">
					<Button.Root variant="secondary" onclick={reset}>
						<Icon.Root icon="lucide:refresh-cw" />
						Try again
					</Button.Root>
				</div>
			</Callout.Body>
		</Callout.Root>
	{/snippet}
</svelte:boundary>
