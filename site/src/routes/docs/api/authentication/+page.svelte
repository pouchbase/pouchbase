<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'endpoints', title: 'Endpoints' },
		{ id: 'tokens', title: 'Tokens' },
		{ id: 'register', title: 'Sign up' },
		{ id: 'login', title: 'Sign in' },
		{ id: 'me', title: 'The signed-in user' },
		{ id: 'emails', title: 'Verification and password reset' },
		{ id: 'oauth', title: 'OAuth' }
	];

	const endpoints = [
		['POST /api/auth/password/register', 'Signs a user up with a name, email and password'],
		['POST /api/auth/password/login', 'Signs a user in with an email and password'],
		['GET /api/auth/me', 'The signed-in user'],
		['POST /api/auth/email/send-verification', 'Emails a link to verify the address'],
		['POST /api/auth/email/verify', 'Verifies the address with the token from the link'],
		['POST /api/auth/password/forgot', 'Emails a link to choose a new password'],
		['POST /api/auth/password/reset', 'Sets a new password with the token from the link'],
		['GET /api/auth/providers', 'The OAuth providers that are turned on'],
		['GET /api/auth/oauth2/<provider>', 'Starts an OAuth sign-in, in a popup'],
		['POST /api/auth/oauth2/result', 'Collects the result of an OAuth sign-in']
	];

	const registerStatuses = [
		['200', 'Signed up: { token, user_id, verification_required }'],
		['400', 'Invalid input, with a message per field in issues'],
		['403', 'Email and password sign-in isn’t turned on, or sign-up isn’t allowed'],
		['409', 'The email address is already in use (issues.email)'],
		['503', 'A verified email is required, but sending email isn’t set up']
	];

	const loginStatuses = [
		['200', 'Signed in: { token, user_id }'],
		['400', 'The body has no email or password'],
		['401', 'Invalid email or password'],
		[
			'403',
			'Email and password sign-in isn’t turned on, or the address isn’t verified yet (code: email_not_verified)'
		]
	];

	const emailEndpoints = [
		[
			'POST /api/auth/email/send-verification',
			'{ email }',
			'{ "sent": true }, for unknown addresses too; 503 without mail settings'
		],
		[
			'POST /api/auth/email/verify',
			'{ token }',
			'{ "verified": true }; 400 for an invalid or expired link'
		],
		[
			'POST /api/auth/password/forgot',
			'{ email }',
			'{ "sent": true }, for unknown addresses too; 503 without mail settings'
		],
		[
			'POST /api/auth/password/reset',
			'{ token, password }',
			'{ "reset": true }; 400 for an invalid or expired link, or a password that is too short'
		]
	];

	const oauthResults = [
		['The user is still signing in: poll again', '202', '{ "status": "pending" }'],
		['Signed in; the result is then deleted', '200', '{ "status": "done", token, user_id }'],
		[
			'Not signed in: access_denied, email_in_use or sign_in_failed',
			'200',
			'{ "status": "error", error }'
		],
		['The verifier doesn’t match the sign-in', '403', '{ message }'],
		['Unknown or expired sign-in', '404', '{ message }']
	];
</script>

<DocsPage
	title="Authentication"
	description="Sign the users of your app up and in with an email and password or with OAuth, get the token to send with every request, and handle verification and password reset."
	{sections}
>
	<p>
		These endpoints sign in the users of your app, the records of the built-in
		<Code.Root>users</Code.Root> collection. Which sign-in methods are on, and whether users must verify
		their email first, is set in the dashboard; see
		<a href={resolve('/docs/platform/authentication')}>Authentication</a>.
	</p>

	<h2 id="endpoints">Endpoints</h2>

	<DocsTable head={['Request', 'Does']} rows={endpoints} />

	<h2 id="tokens">Tokens</h2>

	<p>
		Every sign-in returns a <Code.Root>token</Code.Root> and the <Code.Root>user_id</Code.Root>. The
		token is a JWT, valid for 7 days. Send it with every request as
		<Code.Root>Authorization: Bearer &lt;token&gt;</Code.Root>; the
		<a href={resolve('/docs/platform/collections/access-rules')}>access rules</a> then apply to that
		user. An invalid or expired token is a <Code.Root>401</Code.Root> on every endpoint, so sign the user
		in again. There is no sign-out endpoint: forget the token.
	</p>

	<h2 id="register">Sign up</h2>

	<p>
		<Code.Root>POST /api/auth/password/register</Code.Root> takes a <Code.Root>name</Code.Root>, an
		<Code.Root>email</Code.Root> and a <Code.Root>password</Code.Root> of 8 to 128 characters. With mail
		set up, it sends a verification email.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.register} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.registerResponse} />
	</CodeBlock.Root>

	<p>
		When a verified email is required, <Code.Root>token</Code.Root> is <Code.Root>null</Code.Root> and
		<Code.Root>verification_required</Code.Root> is <Code.Root>true</Code.Root>: the user signs in
		after following the link in the email.
	</p>

	<CodeBlock.Root title="400 Bad Request">
		<CodeBlock.Source code={data.code.registerInvalid} />
	</CodeBlock.Root>

	<DocsTable head={['Status', 'Means']} rows={registerStatuses} />

	<h2 id="login">Sign in</h2>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.login} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.loginResponse} />
	</CodeBlock.Root>

	<p>
		Until the user has verified their address, when that is required, signing in fails with a
		<Code.Root>code</Code.Root> to check for, so your app can offer to send the link again:
	</p>

	<CodeBlock.Root title="403 Forbidden">
		<CodeBlock.Source code={data.code.notVerified} />
	</CodeBlock.Root>

	<DocsTable head={['Status', 'Means']} rows={loginStatuses} />

	<h2 id="me">The signed-in user</h2>

	<p>
		<Code.Root>GET /api/auth/me</Code.Root> returns the user of the token, as a record of
		<Code.Root>users</Code.Root> without its hidden fields, or a <Code.Root>401</Code.Root> without a
		valid token. The view rule of <Code.Root>users</Code.Root> doesn't apply: users can always read their
		own record.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.me} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.meResponse} />
	</CodeBlock.Root>

	<h2 id="emails">Verification and password reset</h2>

	<p>
		These need mail settings in the dashboard. The links in the emails open pages of Pouchbase
		itself, which call the verify and reset endpoints; call them yourself only when your own app
		handles the links. Reset links are valid for 30 minutes and work once; verification links are
		valid for 3 days.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.emails} />
	</CodeBlock.Root>

	<DocsTable head={['Request', 'Body', 'Answers']} rows={emailEndpoints} />

	<p>
		The two endpoints that send an email answer the same whether or not the address has an account,
		so nobody can use them to find out who has one.
	</p>

	<h2 id="oauth">OAuth</h2>

	<p>
		<Code.Root>GET /api/auth/providers</Code.Root> lists the providers that are turned on, to build the
		sign-in buttons from. <Code.Root>iconUrl</Code.Root> is the URL of the provider's logo, or
		<Code.Root>null</Code.Root>:
	</p>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.providers} />
	</CodeBlock.Root>

	<p>
		A sign-in runs in a popup, and the token never appears in a URL. Your app proves it started the
		sign-in with PKCE: it makes a random <Code.Root>state</Code.Root> and a secret
		<Code.Root>verifier</Code.Root>, opens <Code.Root>/api/auth/oauth2/&lt;provider&gt;</Code.Root> with
		the state and the SHA-256 hash of the verifier as <Code.Root>challenge</Code.Root>, and then
		polls
		<Code.Root>POST /api/auth/oauth2/result</Code.Root> with the state and the verifier until the user
		is done. Only a caller that knows the verifier gets the token.
	</p>

	<CodeBlock.Root title="JavaScript">
		<CodeBlock.Source code={data.code.oauth} />
	</CodeBlock.Root>

	<CodeBlock.Root title="200 OK">
		<CodeBlock.Source code={data.code.oauthResult} />
	</CodeBlock.Root>

	<p>
		The start endpoint redirects the popup to the provider, and answers <Code.Root>400</Code.Root> for
		a provider that isn't turned on or a missing state or challenge, and <Code.Root>404</Code.Root> for
		an unknown provider. The result endpoint answers:
	</p>

	<DocsTable head={['When', 'Status', 'Body']} rows={oauthResults} code={0} />
</DocsPage>
