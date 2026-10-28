<script lang="ts">
	import * as ProviderIcon from '#lib/components/ui/provider-icon/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { signInMethodIcon, type SignInMethod } from '#lib/auth/sign-in-methods.js';
	import { formatTimestamp } from './grid';

	type Props = {
		/** How the user can sign in: linked accounts and a password. */
		methods: SignInMethod[];
	};

	let { methods }: Props = $props();
</script>

<section class="flex flex-col gap-2" aria-labelledby="sign-in-methods">
	<h3 id="sign-in-methods" class="text-sm font-medium text-zinc-900">Sign-in methods</h3>

	<Table.Root>
		<Table.Body>
			{#each methods as method, index (`${method.provider}:${method.providerId ?? index}`)}
				<Table.Row>
					<Table.Cell>
						<span class="inline-flex items-center gap-2 font-medium text-zinc-900">
							<ProviderIcon.Root
								src={method.iconUrl}
								fallback={signInMethodIcon(method)}
								class="size-4"
							/>
							{method.label}
						</span>
					</Table.Cell>
					<Table.Cell class="font-mono text-xs text-zinc-500">
						{method.providerId ?? ''}
					</Table.Cell>
					<Table.Cell class="text-right text-xs whitespace-nowrap text-zinc-500">
						{method.provider === 'password' ? 'set' : 'linked'}
						{formatTimestamp(method.linkedAt)}
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell class="text-zinc-500">
						This user can't sign in yet: no linked accounts and no password.
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</section>
