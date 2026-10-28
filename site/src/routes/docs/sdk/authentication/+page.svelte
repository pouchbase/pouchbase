<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'password', title: 'Email and password' },
		{ id: 'oauth', title: 'OAuth' },
		{ id: 'verification-and-reset', title: 'Verification and password reset' },
		{ id: 'session', title: 'The session' },
		{ id: 'session-storage', title: 'Session storage' }
	];

	const oauthErrors = [
		['access_denied', 'The user cancelled the sign-in at the provider'],
		['email_in_use', 'An account with this email exists, made with another sign-in method'],
		['sign_in_failed', 'The provider or Pouchbase couldn’t complete the sign-in'],
		['popup_blocked', 'The browser blocked the popup: call oauth() from a click handler'],
		['popup_closed', 'The user closed the popup'],
		['timeout', 'No answer within the timeout (5 minutes by default)']
	];
</script>

<DocsPage
	title="Authentication"
	description="Sign the users of your app up and in with an email and password or with OAuth, and keep their session between page loads."
	{sections}
>
	<p>
		Turn the sign-in methods on in the dashboard first (see
		<a href={resolve('/docs/platform/authentication')}>Authentication</a>). After a sign-in, the
		client sends the user's token with every request, and the
		<a href={resolve('/docs/platform/collections/access-rules')}>access rules</a> decide what they may
		do.
	</p>

	<h2 id="password">Email and password</h2>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.password} />
	</CodeBlock.Root>

	<p>
		<Code.Root>register()</Code.Root> fails with <Code.Root>invalid</Code.Root> or
		<Code.Root>conflict</Code.Root> (email taken), with a message per field in
		<Code.Root>issues</Code.Root>, and with <Code.Root>forbidden</Code.Root> when sign-up is off. When
		a verified email is required it starts no session, and <Code.Root>login()</Code.Root> fails with the
		code <Code.Root>email_not_verified</Code.Root> until the user followed the link.
	</p>

	<h2 id="oauth">OAuth</h2>

	<p>
		Build the sign-in buttons from <Code.Root>pouch.auth.providers()</Code.Root>
		(<Code.Root>iconUrl</Code.Root> is <Code.Root>null</Code.Root> for a provider without a logo). Call
		<Code.Root>oauth()</Code.Root> straight from a click handler, before any
		<Code.Root>await</Code.Root>, or the browser blocks the popup.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.oauth} />
	</CodeBlock.Root>

	<p>
		The token never appears in a URL: the SDK starts the sign-in with a PKCE challenge and polls for
		the result with its secret verifier. <Code.Root>timeout</Code.Root> and
		<Code.Root>interval</Code.Root> set how long and how often it polls. A failed sign-in has one of these
		codes:
	</p>

	<DocsTable head={['code', 'Means']} rows={oauthErrors} />

	<h2 id="verification-and-reset">Verification and password reset</h2>

	<p>
		These need mail to be set up. The links open pages of Pouchbase itself, so you only need
		<Code.Root>verifyEmail()</Code.Root> and <Code.Root>resetPassword()</Code.Root> when your own app
		handles them.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.mailLinks} />
	</CodeBlock.Root>

	<h2 id="session">The session</h2>

	<p>
		A sign-in begins a session in <Code.Root>pouch.session</Code.Root>: the token, the user's id
		and, once <Code.Root>me()</Code.Root> loaded it, the user. <Code.Root>signedIn</Code.Root> only checks
		the token's expiry; the server can still reject it.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.session} />
	</CodeBlock.Root>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:clock" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Tokens expire after 7 days</Callout.Title>
			<Callout.Description>
				Then requests fail with <Code.Root>unauthorized</Code.Root> and the user signs in again;
				<Code.Root>expiresAt</Code.Root> tells you when.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="session-storage">Session storage</h2>

	<p>
		The <Code.Root>session</Code.Root> option of <Code.Root>createClient()</Code.Root> decides where the
		session is kept: <Code.Root>'memory'</Code.Root> (the default) loses it on reload,
		<Code.Root>'browser'</Code.Root> keeps it in <Code.Root>localStorage</Code.Root> (nothing where that
		is unavailable), and <Code.Root>browserStorage(key)</Code.Root> does the same under your own key.
		For cookies or a native app's secure storage, pass your own <Code.Root>SessionStorage</Code.Root
		>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.storage} />
	</CodeBlock.Root>
</DocsPage>
