<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'openid-connect', title: 'OpenID Connect' },
		{ id: 'other-oauth-providers', title: 'Other OAuth providers' },
		{ id: 'rules', title: 'Rules' }
	];
</script>

<DocsPage
	title="Sign-in providers"
	description="Let your app's users sign in with another OAuth or OpenID Connect provider, next to the built-in ones."
	{sections}
>
	<p>
		Pouchbase handles the redirects and the token exchange; the plugin says where to send people and
		how to read their profile. A provider is a <Code.Root>defineAuthProvider(...)</Code.Root> in
		<Code.Root>authProviders</Code.Root> of <Code.Root>definePlugin</Code.Root>, whose key is its
		id:
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.authProviderPlugin} />
	</CodeBlock.Root>

	<p>
		The templates keep it in <Code.Root>auth/&lt;id&gt;/provider.ts</Code.Root>, next to its logo.
		<Code.Root>icon</Code.Root> is the logo on the sign-in button, shown in its own colors: an imported
		<Code.Root>.svg</Code.Root> file or an Iconify name, such as
		<Code.Root>logos:gitlab-icon</Code.Root>. Without one, the button has no logo.
	</p>

	<h2 id="openid-connect">OpenID Connect</h2>

	<p>
		<Code.Root>createOidcProvider</Code.Root> reads the profile from the userinfo endpoint. Scopes default
		to <Code.Root>openid email profile</Code.Root>, PKCE is on, and <Code.Root>mapProfile</Code.Root
		> adjusts the result:
	</p>

	<CodeBlock.Root title="auth/gitlab/provider.ts">
		<CodeBlock.Source code={data.code.authProvider} />
	</CodeBlock.Root>

	<h2 id="other-oauth-providers">Other OAuth providers</h2>

	<p>
		Write <Code.Root>profile</Code.Root> yourself: it gets the access token and returns the user.
		<Code.Root>fetchJson</Code.Root> sends the token and throws when the request fails. From the built-in
		GitHub sign-in:
	</p>

	<CodeBlock.Root title="auth/github/provider.ts">
		<CodeBlock.Source code={data.code.authProviderProfile} />
	</CodeBlock.Root>

	<p>
		The <a href="https://github.com/pouchbase/pouchbase/tree/main/plugins">built-in providers</a>
		are good examples: <Code.Root>auth-github</Code.Root> reads a REST API, <Code.Root
			>auth-twitch</Code.Root
		>
		sends the client id along.
	</p>

	<h2 id="rules">Rules</h2>

	<ul>
		<li>
			Only set <Code.Root>emailVerified</Code.Root> when the provider guarantees the email belongs to
			the user: a verified email links the sign-in to an existing user with that email.
		</li>
		<li>
			Add the hosts <Code.Root>profile</Code.Root> calls to
			<a href="{resolve('/docs/plugins/project-structure')}#the-manifest"
				><Code.Root>permissions.network</Code.Root></a
			>.
		</li>
		<li>
			Pouchbase reads the URLs, scopes and PKCE setting once, when the plugin is installed or
			updated.
		</li>
		<li>
			Provider ids are global: Pouchbase refuses a plugin whose provider id another installed plugin
			already has. <Code.Root>password</Code.Root>, <Code.Root>email</Code.Root> and
			<Code.Root>otp</Code.Root> are reserved. Never rename a provider once people use it.
		</li>
	</ul>

	<p>
		Admins turn the provider on and enter its client ID and secret on the
		<strong>Authentication</strong> page of the dashboard, like the built-in ones (see
		<a href="{resolve('/docs/authentication')}#sign-in-methods">Sign-in methods</a>).
	</p>
</DocsPage>
