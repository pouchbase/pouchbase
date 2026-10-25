<script lang="ts">
	import type { OAuthProviderInfo } from '@pouchbasejs/js-sdk';
	import Output from '#lib/components/output.svelte';
	import Panel from '#lib/components/panel.svelte';
	import { auth, pouch } from '#lib/pouchbase.svelte.js';
	import { Runner } from '#lib/run.svelte.js';

	const runner = new Runner();

	let providers = $state<OAuthProviderInfo[]>([]);
	let register = $state({ name: '', email: '', password: '' });
	let login = $state({ email: '', password: '' });
	let email = $state('');
	let token = $state('');
	let newPassword = $state('');

	pouch.auth.providers().then(
		(list) => (providers = list),
		() => (providers = [])
	);
</script>

<Panel title="Session" description="pouch.session, kept in localStorage (session: 'browser')">
	<div class="row">
		<button disabled={runner.loading} onclick={() => runner.run(() => pouch.auth.me())}>
			pouch.auth.me()
		</button>
		<button
			class="ghost"
			onclick={() =>
				runner.run(async () => ({
					signedIn: pouch.session.signedIn,
					expiresAt: pouch.session.expiresAt
				}))}
		>
			session.signedIn
		</button>
		<button class="ghost" disabled={!auth.session} onclick={() => pouch.session.end()}>
			pouch.session.end()
		</button>
		<button class="ghost" disabled={!auth.session} onclick={() => pouch.auth.logout()}>
			pouch.auth.logout()
		</button>
	</div>
	<pre>{JSON.stringify(auth.session, null, 2)}</pre>
</Panel>

<Output outcome={runner.outcome} />

<div class="grid">
	<Panel title="Sign up" description="POST /api/auth/password/register">
		<form
			class="stack"
			onsubmit={(event) => {
				event.preventDefault();
				runner.run(() =>
					pouch.auth.register({
						name: register.name,
						email: register.email,
						password: register.password
					})
				);
			}}
		>
			<label>Name <input bind:value={register.name} autocomplete="name" /></label>
			<label>Email <input bind:value={register.email} type="email" autocomplete="email" /></label>
			<label>
				Password <input
					bind:value={register.password}
					type="password"
					autocomplete="new-password"
				/>
			</label>
			<button disabled={runner.loading}>Sign up</button>
		</form>
	</Panel>

	<Panel title="Sign in" description="POST /api/auth/password/login">
		<form
			class="stack"
			onsubmit={(event) => {
				event.preventDefault();
				runner.run(() => pouch.auth.login(login.email, login.password));
			}}
		>
			<label>Email <input bind:value={login.email} type="email" autocomplete="email" /></label>
			<label>
				Password
				<input bind:value={login.password} type="password" autocomplete="current-password" />
			</label>
			<button disabled={runner.loading}>Sign in</button>
		</form>
	</Panel>

	<Panel title="OAuth" description="pouch.auth.oauth() opens a popup">
		<div class="row">
			{#each providers as provider (provider.provider)}
				<button
					disabled={runner.loading}
					onclick={() => runner.run(() => pouch.auth.oauth(provider.provider))}
				>
					{provider.label}
				</button>
			{:else}
				<p class="muted">No providers are enabled on this instance.</p>
			{/each}
		</div>
	</Panel>

	<Panel title="Email" description="Password resets and verification">
		<div class="stack">
			<label>Email <input bind:value={email} type="email" /></label>
			<div class="row">
				<button
					disabled={runner.loading}
					onclick={() => runner.run(() => pouch.auth.sendPasswordReset(email))}
				>
					Send reset
				</button>
				<button
					disabled={runner.loading}
					onclick={() => runner.run(() => pouch.auth.sendVerification(email))}
				>
					Send verification
				</button>
			</div>
			<label>Token from the email <input bind:value={token} /></label>
			<label>New password <input bind:value={newPassword} type="password" /></label>
			<div class="row">
				<button
					disabled={runner.loading}
					onclick={() => runner.run(() => pouch.auth.resetPassword(token, newPassword))}
				>
					Reset password
				</button>
				<button
					disabled={runner.loading}
					onclick={() => runner.run(() => pouch.auth.verifyEmail(token))}
				>
					Verify email
				</button>
			</div>
		</div>
	</Panel>
</div>

<style>
	pre {
		margin: 0;
		font-size: 0.8125rem;
		overflow: auto;
	}
</style>
