<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	const sections: Section[] = [
		{ id: 'keys-and-tokens', title: 'Keys and tokens' },
		{ id: 'admin-access', title: 'Admin access' },
		{ id: 'creating-a-key', title: 'Creating a key' },
		{ id: 'keys-of-functions-and-plugins', title: 'Keys of functions and plugins' },
		{ id: 'using-a-key', title: 'Using a key' }
	];
</script>

<DocsPage
	title="API keys"
	description="Secret keys for server-side code, such as your back-end and your functions, to call what an app user can't: sending email, managing records past the access rules and changing the schema."
	{sections}
>
	<h2 id="keys-and-tokens">Keys and tokens</h2>

	<p>
		An app acts for its signed-in user, with the user's
		<a href="{resolve('/docs/platform/authentication')}#tokens">token</a>, and the
		<a href={resolve('/docs/platform/collections/access-rules')}>access rules</a> decide what that
		user may do. Server-side code that needs more, such as sending email or creating a collection in
		a deploy script, uses an <strong>API key</strong>. It starts with <Code.Root>pbk_</Code.Root> and
		is sent like a token: <Code.Root>Authorization: Bearer pbk_…</Code.Root>.
	</p>

	<h2 id="admin-access">Admin access</h2>

	<p>
		Every key acts as an admin: it reads and writes records past the access rules, including hidden
		fields, sees every change over realtime, manages the schema and sends email. The only exception
		is the key of a plugin's Worker, which only reaches the records API of the collections the
		plugin may use and gets <Code.Root>403</Code.Root> everywhere else.
	</p>

	<h2 id="creating-a-key">Creating a key</h2>

	<p>
		Create keys in the dashboard under <strong>System → API keys</strong>, with a name that says
		what uses it. The key is shown once, since Pouchbase only stores a hash: replace a lost key with
		a new one. A deleted key stops working right away.
	</p>

	<Callout.Root variant="error">
		<Callout.Icon><Icon.Root icon="lucide:key-round" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Never put a key in a browser</Callout.Title>
			<Callout.Description>
				Anyone with a key can do everything an admin can. Keep keys in the environment of your
				server, and use the user's token in the browser.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="keys-of-functions-and-plugins">Keys of functions and plugins</h2>

	<ul>
		<li>
			Every <a href={resolve('/docs/platform/functions')}>function</a> gets a key of its own in
			<Code.Root>env.POUCHBASE_API_KEY</Code.Root>, an admin key like any other. It is renewed on
			every deploy; the old one stops working once the new version runs. The API keys page lists it,
			but it is deleted with its function, not on its own.
		</li>
		<li>
			The Worker of an installed <a href={resolve('/docs/plugins')}>plugin</a> gets a plugin key, renewed
			on every install and update, which only reaches the records API of the collections the plugin may
			use. These keys aren't listed.
		</li>
	</ul>

	<h2 id="using-a-key">Using a key</h2>

	<ul>
		<li>
			With TypeScript, pass the key to the client; see
			<a href={resolve('/docs/sdk/api-keys')}>API keys</a> in the JS SDK.
		</li>
		<li>
			From other languages, send it in the <Code.Root>Authorization</Code.Root> header; see the
			<a href={resolve('/docs/api/introduction')}>REST API introduction</a>.
		</li>
	</ul>
</DocsPage>
