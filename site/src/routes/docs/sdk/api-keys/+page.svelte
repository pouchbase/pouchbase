<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'a-client-with-a-key', title: 'A client with a key' },
		{ id: 'admin-access', title: 'Admin access' }
	];
</script>

<DocsPage
	title="API keys"
	description="Use an API key in server-side code for what an app user can't do: sending email, managing the schema and reading or writing records past the access rules."
	{sections}
>
	<h2 id="a-client-with-a-key">A client with a key</h2>

	<p>
		Email and the schema need an API key (<Code.Root>pbk_…</Code.Root>). Create one in the dashboard
		(see <a href={resolve('/docs/platform/api-keys')}>API keys</a>) and pass it as
		<Code.Root>apiKey</Code.Root>. A <a href={resolve('/docs/platform/functions')}>function</a> gets
		<Code.Root>env.POUCHBASE_URL</Code.Root> and a key of its own in
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
				Anyone with the key has admin access to your data. Keep keys in your server's environment.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="admin-access">Admin access</h2>

	<p>
		A client with an <Code.Root>apiKey</Code.Root> sends the key instead of the session's token on every
		request and realtime connection, so the access rules don't apply.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.adminClient} />
	</CodeBlock.Root>
</DocsPage>
