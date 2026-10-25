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
				'That version is already published. Published versions never change: bump version in package.json for every release.'
		},
		{ status: '413', about: 'The bundle is larger than 1 MiB.' },
		{
			status: '422',
			about:
				'The bundle isn’t valid, has an unknown category or an API version the registry doesn’t know.'
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
		Published plugins are listed in the public registry, which every Pouchbase searches by default.
		You need an account on <a href={resolve('/account')}>pouchbase.io</a>; the first version of a
		plugin makes its id yours.
	</p>

	<p>
		Create a token under <strong>Publish tokens</strong> on your
		<a href={resolve('/account')}>account page</a>, then publish:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.publish} />
	</CodeBlock.Root>

	<p>A token publishes as you, so keep it secret. In CI, store it as a secret:</p>

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
		Admins search and install plugins on the <strong>Plugins</strong> page of the dashboard, which shows
		what a plugin adds and the hosts it may reach. On install, Pouchbase:
	</p>

	<ul>
		<li>checks the bundle against the integrity hash the registry lists for that version;</li>
		<li>compiles the components, so one that doesn't compile stops the install;</li>
		<li>
			deploys the server code as a Worker named <Code.Root
				>&lt;instance&gt;-plugin-&lt;id&gt;</Code.Root
			>
			on its Cloudflare account, which counts toward the plan's limits;
		</li>
		<li>
			marks the plugin <strong>Needs settings</strong> while a
			<a href={resolve('/docs/plugins/settings')}>required setting</a> is empty.
		</li>
	</ul>

	<p>
		Removing a plugin deletes its Worker and its settings. Fields of its types keep their data, but
		become read-only. Built-in plugins can't be removed; a newer version of one from the registry
		replaces it until that version is removed.
	</p>

	<h2 id="updates">Updates</h2>

	<p>
		An update replaces the plugin's code, components and Worker. Records, field values and saved
		settings are kept. To keep installations working:
	</p>

	<ul>
		<li>
			Never rename a field type or a sign-in provider once people use it: fields of the old type
			become read-only.
		</li>
		<li>
			Don't rename settings: a renamed setting starts empty, or at its default, until an admin saves
			it again.
		</li>
		<li>
			Keep <Code.Root>deserialize</Code.Root> and the preview of a field type reading old values when
			you change <Code.Root>serialize</Code.Root>: stored values are never rewritten.
		</li>
		<li>
			A field keeps the <Code.Root>column</Code.Root> type it was created with, whatever a new version
			says.
		</li>
		<li>
			Routes and pages are public paths: renaming one breaks the apps and bookmarks that use it.
		</li>
	</ul>

	<h2 id="compatibility">Compatibility</h2>

	<ul>
		<li>
			Set <Code.Root>engines.pouchbase</Code.Root> to the lowest Pouchbase version that has everything
			the plugin uses. What these docs describe ships with Pouchbase 0.10.0, so start from
			<Code.Root>&gt;=0.10.0</Code.Root> and raise it when you use something newer. Pouchbase only installs
			a version whose range it satisfies.
		</li>
		<li>
			Within plugin API version 1, changes are only additive. A change that would break plugins
			bumps the API version; Pouchbase supports the current one and the one before.
		</li>
		<li>
			Plugins written before <Code.Root>definePlugin</Code.Root> in <Code.Root>plugin.ts</Code.Root
			>, with
			<Code.Root>contributes</Code.Root> and
			<Code.Root>server</Code.Root> in the manifest, still build with a warning until API version 2. The
			<a href="https://github.com/pouchbase/pouchbase/tree/main/packages/plugin-sdk#legacy-layout"
				>SDK README</a
			> explains how to move them.
		</li>
	</ul>

	<h2 id="private-registries">Private registries</h2>

	<p>
		Pouchbase and the CLI use the public registry, <Code.Root>https://api.pouchbase.io</Code.Root>,
		unless <Code.Root>POUCHBASE_REGISTRY_URL</Code.Root> is set: as a server variable of an installation,
		it decides where the Plugins page installs from; for the CLI, where
		<Code.Root>publish</Code.Root> uploads to (or pass <Code.Root>--registry</Code.Root>).
	</p>

	<p>
		Any server that implements the
		<a href="https://github.com/pouchbase/pouchbase/tree/main/packages/plugin-sdk#registry-api"
			>registry API</a
		> can be a registry, for example for private plugins.
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
