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
		{ id: 'a-client-with-a-key', title: 'A client with a key' },
		{ id: 'scopes', title: 'Scopes' },
		{ id: 'service-access', title: 'Service access' }
	];

	const scopes = [
		[
			'standard',
			'pouch.mail.send() and the other server-only endpoints; the key of a function has this scope'
		],
		[
			'service',
			'Also pouch.schema, and the records API through pouch.asService(), as an admin: the access rules don’t apply'
		]
	];
</script>

<DocsPage
	title="API keys"
	description="Use an API key in server-side code for what an app user can't do: sending email, managing the schema and reading or writing records past the access rules."
	{sections}
>
	<h2 id="a-client-with-a-key">A client with a key</h2>

	<p>
		Some calls need an API key (<Code.Root>pbk_…</Code.Root>) instead of a user's token. Create one
		in the dashboard, under <strong>System → API keys</strong> (see
		<a href={resolve('/docs/platform/api-keys')}>API keys</a>), and pass it to the client as
		<Code.Root>apiKey</Code.Root>. In a <a href={resolve('/docs/platform/functions')}>function</a>,
		Pouchbase sets <Code.Root>env.POUCHBASE_URL</Code.Root> and a key of the function's own in
		<Code.Root>env.POUCHBASE_API_KEY</Code.Root>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.apiKeyClient} />
	</CodeBlock.Root>

	<Callout.Root variant="error">
		<Callout.Icon><Icon.Root icon="lucide:key-round" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Never put a key in a browser</Callout.Title>
			<Callout.Description>
				Anyone who has the key can do what it allows. Keep keys in the environment of your server,
				and use a user's token in code that runs in the browser.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="scopes">Scopes</h2>

	<p>A key has one of two scopes, chosen when you create it:</p>

	<DocsTable head={['Scope', 'Allows']} rows={scopes} />

	<p>
		A key of the standard scope gets <Code.Root>forbidden</Code.Root> from the records API. The key is
		only sent on the calls that need it; other calls send the session's token as usual.
	</p>

	<h2 id="service-access">Service access</h2>

	<p>
		<Code.Root>pouch.asService()</Code.Root> returns a client that sends the key instead of a user's token,
		for a back-end that writes what users may not, such as a <Code.Root>featured</Code.Root>
		flag. Its records calls act as an admin. It throws without an <Code.Root>apiKey</Code.Root>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.asService} />
	</CodeBlock.Root>
</DocsPage>
