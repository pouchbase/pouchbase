<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'publish', title: 'Publish' },
		{ id: 'installing', title: 'Installing' },
		{ id: 'updates', title: 'Updates' },
		{ id: 'compatibility', title: 'Compatibility' },
		{ id: 'private-registries', title: 'Private registries' }
	];

	const refusals = [
		{ status: '401', about: 'There is no valid token.' },
		{ status: '403', about: 'The plugin id belongs to another account.' },
		{
			status: '409',
			about:
				'That version is already published. Versions never change: bump version in package.json for every release.'
		},
		{ status: '413', about: 'The bundle is larger than 25 MiB.' },
		{
			status: '422',
			about: 'The bundle isn’t valid, is for another id, or has an unknown category or API version.'
		}
	];
</script>

<DocsPage
	title="Publishing and updates"
	description="Publish a plugin to the registry, so every Pouchbase can install it, and release new versions without breaking the installations that use it."
	{sections}
>
	<h2 id="publish">Publish</h2>

	<p>
		Every Pouchbase searches the public registry by default. To publish, create a token under
		<strong>Publish tokens</strong> on your <a href={resolve('/account')}>pouchbase.io account</a>;
		the first version of a plugin makes its id yours.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.publish} />
	</CodeBlock.Root>

	<p>A token publishes as you: in CI, store it as a secret.</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.ci} />
	</CodeBlock.Root>

	<p>
		Without a token, build the bundle and upload it under <strong>Publish a version</strong> on the account
		page:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.build} />
	</CodeBlock.Root>

	<p>The registry refuses a version when:</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Status</Table.Head>
				<Table.Head>Why</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each refusals as { status, about } (status)}
				<Table.Row>
					<Table.Cell><Code.Root>{status}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<h2 id="installing">Installing</h2>

	<p>
		Admins install plugins from the <strong>Plugins</strong> page, which shows what a plugin adds and
		the hosts it may reach. On install, Pouchbase:
	</p>

	<ul>
		<li>checks the bundle against the integrity hash the registry lists for that version;</li>
		<li>compiles the components: one that doesn't compile stops the install;</li>
		<li>
			deploys the server code as a Worker, <Code.Root>&lt;instance&gt;-plugin-&lt;id&gt;</Code.Root
			>, on its Cloudflare account, which counts toward the plan's limits;
		</li>
		<li>creates the plugin's <a href={resolve('/docs/plugins/collections')}>collections</a>;</li>
		<li>
			marks the plugin <strong>Needs settings</strong> while a
			<a href={resolve('/docs/plugins/settings')}>required setting</a> is empty.
		</li>
	</ul>

	<p>
		Removing a plugin deletes its Worker, its settings and its own collections with their records;
		it is refused while a relation field of another collection points to one of them. Fields of its
		types elsewhere keep their data, but become read-only. Built-in plugins can't be removed; a
		newer version of one from the registry replaces it until that version is removed.
	</p>

	<h2 id="updates">Updates</h2>

	<p>
		An update replaces the plugin's code, components and Worker, and keeps records, field values and
		saved settings. To keep installations working:
	</p>

	<ul>
		<li>
			Never rename a field type or a sign-in provider once in use: fields of the old type become
			read-only.
		</li>
		<li>
			Don't rename settings: a renamed setting starts empty, or at its default, until an admin saves
			it again.
		</li>
		<li>
			Stored values are never rewritten: when you change <Code.Root>serialize</Code.Root>, keep
			<Code.Root>deserialize</Code.Root> and the preview reading old values.
		</li>
		<li>
			A field keeps the <Code.Root>column</Code.Root> type it was created with, whatever a new version
			says.
		</li>
		<li>Routes and pages are public paths: renaming one breaks the apps and bookmarks using it.</li>
	</ul>

	<h2 id="compatibility">Compatibility</h2>

	<ul>
		<li>
			Set <Code.Root>engines.pouchbase</Code.Root> to the lowest Pouchbase version with everything the
			plugin uses, starting from <Code.Root>&gt;=0.10.0</Code.Root>, which ships what these docs
			describe. Pouchbase only installs a version whose range it satisfies.
		</li>
		<li>
			Within plugin API version 1, changes are only additive; a breaking change bumps the API
			version. Until Pouchbase 1.0 only the current one is supported, so a plugin built for an older
			one has to be rebuilt.
		</li>
	</ul>

	<h2 id="private-registries">Private registries</h2>

	<p>
		Pouchbase and the CLI use the public registry, <Code.Root>https://api.pouchbase.io</Code.Root>,
		unless <Code.Root>POUCHBASE_REGISTRY_URL</Code.Root> is set: as a server variable of an installation,
		it decides where the Plugins page installs from; for the CLI, where
		<Code.Root>publish</Code.Root> uploads to (or pass <Code.Root>--registry</Code.Root>). Any
		server that implements the
		<a href="https://github.com/pouchbase/pouchbase/tree/main/packages/plugin-sdk#registry-api"
			>registry API</a
		> can be a registry.
	</p>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:scale" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Any license</Callout.Title>
			<Callout.Description>
				The plugin SDK is MIT-licensed, and plugins may use any license under the
				<a href="https://github.com/pouchbase/pouchbase/blob/main/PLUGIN-EXCEPTION.md"
					>Pouchbase Plugin Exception</a
				>.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>
</DocsPage>
