<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	const sections: Section[] = [
		{ id: 'keys-and-tokens', title: 'Keys and tokens' },
		{ id: 'scopes', title: 'Scopes' },
		{ id: 'creating-a-key', title: 'Creating a key' },
		{ id: 'keys-of-functions-and-plugins', title: 'Keys of functions and plugins' },
		{ id: 'using-a-key', title: 'Using a key' }
	];

	const scopes = [
		[
			'Standard',
			'The endpoints only server-side code may call, such as sending email',
			'The records API (403)'
		],
		[
			'Service',
			'Those too, the records API as an admin (the access rules don’t apply) and the schema API',
			'–'
		],
		[
			'Plugin',
			'The records API of the collections a plugin may use; only the Worker of a plugin has one',
			'Everything else (403)'
		]
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
		user may do. Server-side code often has to do more: send an email, write a field users may not
		change, or create a collection in a deploy script. For that it uses an <strong>API key</strong>,
		which starts with <Code.Root>pbk_</Code.Root> and is sent the same way as a token:
		<Code.Root>Authorization: Bearer pbk_…</Code.Root>.
	</p>

	<h2 id="scopes">Scopes</h2>

	<p>The scope of a key sets what it may call:</p>

	<DocsTable head={['Scope', 'May call', 'Refused']} rows={scopes} code={0} />

	<p>
		Choose <strong>Standard</strong> unless the code has to manage records or collections; a key can't
		change its scope later, so create a new one when you need another.
	</p>

	<h2 id="creating-a-key">Creating a key</h2>

	<p>
		Create keys in the dashboard, under <strong>System → API keys</strong>, with a name that says
		what uses it and a scope. The key is shown once: copy it into the environment of your server
		then. Pouchbase only stores a hash of it, so a lost key can't be shown again; delete it and
		create a new one. Deleting a key stops it from working right away.
	</p>

	<Callout.Root variant="error">
		<Callout.Icon><Icon.Root icon="lucide:key-round" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Never put a key in a browser</Callout.Title>
			<Callout.Description>
				Anyone who has a key can do everything its scope allows: send your templates to any address
				and, with a service key, read and write every record. Keep keys in the environment of your
				server, and use the user's token in code that runs in the browser.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="keys-of-functions-and-plugins">Keys of functions and plugins</h2>

	<ul>
		<li>
			Every <a href={resolve('/docs/platform/functions')}>function</a> gets a key of its own, with
			the standard scope, in <Code.Root>env.POUCHBASE_API_KEY</Code.Root>. It is renewed on every
			deploy, and the keys of older versions stop working once the new version runs. The API keys
			page lists these keys, but they go with their function: deleting the function deletes its key.
		</li>
		<li>
			The Worker of an installed <a href={resolve('/docs/plugins')}>plugin</a> gets a plugin key, renewed
			on every deploy too. These keys aren't listed on the API keys page.
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
