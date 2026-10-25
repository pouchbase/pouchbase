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
		Turn the sign-in methods on in the dashboard first; see
		<a href={resolve('/docs/platform/authentication')}>Authentication</a> in the platform docs.
		After a sign-in, the client sends the user's token with every request, and the
		<a href={resolve('/docs/platform/collections/access-rules')}>access rules</a> decide what they may
		do.
	</p>

	<h2 id="password">Email and password</h2>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.password} />
	</CodeBlock.Root>

	<p>
		<Code.Root>register()</Code.Root> fails with <Code.Root>invalid</Code.Root> (400) or
		<Code.Root>conflict</Code.Root> (409, for an email that is taken), with a message per field in
		<Code.Root>issues</Code.Root>, and with <Code.Root>forbidden</Code.Root> when sign-up is off. When
		a verified email is required, it returns no session (<Code.Root>verificationRequired</Code.Root> is
		<Code.Root>true</Code.Root>), and <Code.Root>login()</Code.Root> fails with
		<Code.Root>forbidden</Code.Root> and the code <Code.Root>email_not_verified</Code.Root> until the
		user followed the link. Wrong credentials are <Code.Root>unauthorized</Code.Root>.
	</p>

	<h2 id="oauth">OAuth</h2>

	<p>
		Build the sign-in buttons from <Code.Root>pouch.auth.providers()</Code.Root>: the enabled
		providers with their <Code.Root>label</Code.Root> and <Code.Root>iconUrl</Code.Root>, the URL of
		the provider's logo (or <Code.Root>null</Code.Root>). Call <Code.Root>oauth()</Code.Root> straight
		from a click handler, before any <Code.Root>await</Code.Root>: browsers only allow the popup
		then.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.oauth} />
	</CodeBlock.Root>

	<p>
		The token never appears in a URL. The SDK starts the sign-in with the hash of a secret verifier
		(PKCE), and only a caller with that verifier can collect the result. Outside the browser, pass
		<Code.Root>open</Code.Root> to open the sign-in page another way;
		<Code.Root>timeout</Code.Root> and <Code.Root>interval</Code.Root> set how long and how often it waits
		for the result. A failed sign-in has one of these codes:
	</p>

	<DocsTable head={['code', 'Means']} rows={oauthErrors} />

	<h2 id="verification-and-reset">Verification and password reset</h2>

	<p>
		These send the emails of Pouchbase, which need mail to be set up. Their links open pages of
		Pouchbase itself, so you only need <Code.Root>verifyEmail()</Code.Root> and
		<Code.Root>resetPassword()</Code.Root> when you handle the links in your own app.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.mailLinks} />
	</CodeBlock.Root>

	<h2 id="session">The session</h2>

	<p>
		A sign-in begins a session in <Code.Root>pouch.session</Code.Root>: the token, the user's id
		and, once known, the user. <Code.Root>pouch.auth.logout()</Code.Root> ends it.
		<Code.Root>signedIn</Code.Root> only looks at the token: it is <Code.Root>true</Code.Root> while there
		is one that hasn't expired, and the server can still reject it.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.session} />
	</CodeBlock.Root>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:clock" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Tokens expire after 7 days</Callout.Title>
			<Callout.Description>
				A request with an expired token fails with <Code.Root>unauthorized</Code.Root>. Sign the
				user in again; <Code.Root>expiresAt</Code.Root> tells you when.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="session-storage">Session storage</h2>

	<p>
		Where the session is kept between page loads is up to the <Code.Root>session</Code.Root> option of
		<Code.Root>createClient()</Code.Root>: <Code.Root>'memory'</Code.Root> (the default) keeps nothing,
		so a reload signs the user out; <Code.Root>'browser'</Code.Root> keeps it in
		<Code.Root>localStorage</Code.Root> (and falls back to nothing where that doesn't exist);
		<Code.Root>browserStorage(key)</Code.Root> does the same under a key of your own. For anything else,
		such as cookies or a native app's secure storage, pass a
		<Code.Root>SessionStorage</Code.Root> with <Code.Root>load</Code.Root>,
		<Code.Root>persist</Code.Root> and <Code.Root>forget</Code.Root>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.storage} />
	</CodeBlock.Root>
</DocsPage>
