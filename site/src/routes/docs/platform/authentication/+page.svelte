<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	const sections: Section[] = [
		{ id: 'app-users', title: 'App users' },
		{ id: 'sign-in-methods', title: 'Sign-in methods' },
		{ id: 'password', title: 'Email and password' },
		{ id: 'oauth', title: 'OAuth' },
		{ id: 'mail', title: 'Verification and password reset' },
		{ id: 'tokens', title: 'Tokens' },
		{ id: 'in-your-app', title: 'In your app' }
	];
</script>

<DocsPage
	title="Authentication"
	description="Let the users of your app sign in with an email and password or with OAuth, and decide in the dashboard how they sign up and verify their address."
	{sections}
>
	<h2 id="app-users">App users</h2>

	<p>
		Every installation has a built-in <Code.Root>users</Code.Root> collection for the users of your app,
		separate from the admins who sign in to the dashboard. It has the fields
		<Code.Root>email</Code.Root> (unique), <Code.Root>name</Code.Root> (the full name),
		<Code.Root>avatar</Code.Root> (a file) and <Code.Root>verified</Code.Root>, which can't be
		renamed or deleted; you can add fields of your own. Password hashes are kept in an internal
		table, never in <Code.Root>users</Code.Root>.
	</p>

	<p>
		Users sign up; the records API can't create them or change their <Code.Root>email</Code.Root> or
		<Code.Root>verified</Code.Root>. The other fields follow the
		<a href={resolve('/docs/platform/collections/access-rules')}>access rules</a> of
		<Code.Root>users</Code.Root>. A signed-in user can always read their own record through
		<Code.Root>/api/auth/me</Code.Root>, except its
		<a href="{resolve('/docs/platform/collections')}#hidden-fields">hidden fields</a>: put what
		users mustn't see or change, such as a role, there.
	</p>

	<h2 id="sign-in-methods">Sign-in methods</h2>

	<p>Turn them on under <strong>System → Authentication</strong> in the dashboard:</p>

	<ul>
		<li>
			<strong>Email and password</strong>, optionally with self sign-up and
			<strong>Require a verified email</strong>. Admins set a user's password in the
			<Code.Root>users</Code.Root> collection.
		</li>
		<li>
			<strong>OAuth</strong> with Google, GitHub, Microsoft, Discord and Twitch (built-in plugins),
			or any provider a <a href={resolve('/docs/plugins/sign-in-providers')}>sign-in plugin</a> adds.
		</li>
	</ul>

	<h2 id="password">Email and password</h2>

	<p>
		A sign-up needs a name, an unused email and a password. With mail set up, it sends a
		verification email. When a verified email is required, a sign-up doesn't sign the user in, and
		login fails with <Code.Root>email_not_verified</Code.Root> until they follow the link. A failed login
		doesn't say whether the email or the password was wrong.
	</p>

	<h2 id="oauth">OAuth</h2>

	<p>
		Create an OAuth app at the provider, register the callback URL that the setup dialog shows, and
		enter the client ID and secret. Your app can list the enabled providers with their name and
		logo, to show a button per provider.
	</p>

	<p>
		The sign-in runs in a popup, and the token never appears in a URL: the app starts it with the
		hash of a secret verifier (PKCE), and only a caller with that verifier can collect the result.
	</p>

	<p>
		An OAuth sign-in is linked to an existing user with the same email only when the provider
		verified that email (Google, GitHub and Discord do; Microsoft and Twitch don't), so nobody can
		take over an account by claiming its address. A new user gets the provider's profile picture as
		avatar.
	</p>

	<h2 id="mail">Verification and password reset</h2>

	<p>
		These emails need mail settings, under <strong>Mail → Sending</strong> in the dashboard:
	</p>

	<ul>
		<li>
			<strong>Cloudflare Email Service</strong>, with the instance's own API token, which then needs
			Email Sending (Edit). Onboard the sender's domain under Email Service → Email Sending first.
		</li>
		<li>
			<strong>An SMTP server</strong>, with TLS (port 465), STARTTLS (587) or no encryption. Workers
			can't connect to port 25.
		</li>
	</ul>

	<p>
		The links open pages of Pouchbase itself (<Code.Root>/account/verify-email</Code.Root> and
		<Code.Root>/account/reset-password</Code.Root>), unless your app handles them. Reset links are
		valid for 30 minutes and work once; verification links for 3 days. Edit the emails like any
		other
		<a href="{resolve('/docs/platform/email')}#built-in-emails">email template</a>.
	</p>

	<h2 id="tokens">Tokens</h2>

	<p>
		Every sign-in returns a token: a JWT (HS256), valid for 7 days. Apps send it as
		<Code.Root>Authorization: Bearer &lt;token&gt;</Code.Root>, and Pouchbase checks it before
		access rules, functions and realtime see the user. An invalid or expired token is refused, not
		treated as signed out.
	</p>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:shield-check" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>What a user may do is up to the access rules</Callout.Title>
			<Callout.Description>
				Signing in only proves who the user is. What they may do with records is set per collection;
				see
				<a
					href={resolve('/docs/platform/collections/access-rules')}
					class="font-medium underline underline-offset-2">Access rules</a
				>.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="in-your-app">In your app</h2>

	<ul>
		<li>
			With TypeScript, sign users in and keep their session with the
			<a href={resolve('/docs/sdk/authentication')}>JS SDK</a>.
		</li>
		<li>
			From other languages, call the
			<a href={resolve('/docs/api/authentication')}>authentication endpoints</a> of the REST API.
		</li>
	</ul>
</DocsPage>
