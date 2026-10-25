<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as LinkCard from '#lib/components/ui/link-card/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'what-a-plugin-can-add', title: 'What a plugin can add' },
		{ id: 'quick-start', title: 'Quick start' },
		{ id: 'examples', title: 'Examples' }
	];

	const contributions = [
		{
			title: 'Field types',
			href: resolve('/docs/plugins/field-types'),
			icon: 'lucide:text-cursor-input',
			description:
				'New types for collections, with an input in the record form, a preview in the grid and validation on the server.'
		},
		{
			title: 'Dashboard pages',
			href: resolve('/docs/plugins/pages'),
			icon: 'lucide:layout-dashboard',
			description: 'Svelte pages in the dashboard, linked in the sidebar under Plugins.'
		},
		{
			title: 'Routes',
			href: resolve('/docs/plugins/routes'),
			icon: 'lucide:route',
			description: 'HTTP endpoints under /api/plugins/<id>/, for your pages, apps and webhooks.'
		},
		{
			title: 'Sign-in providers',
			href: resolve('/docs/plugins/sign-in-providers'),
			icon: 'lucide:log-in',
			description: 'OAuth and OpenID Connect sign-in for your app’s users.'
		},
		{
			title: 'Settings',
			href: resolve('/docs/plugins/settings'),
			icon: 'lucide:settings',
			description: 'Typed values an admin fills in, such as an API key.'
		}
	];
</script>

<DocsPage
	title="Plugins"
	description="Extend Pouchbase with field types, dashboard pages, routes, sign-in providers and settings, and publish them so any installation can install them without a rebuild."
	{sections}
>
	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:info" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Plugin API version 1</Callout.Title>
			<Callout.Description>
				The built-in Google, GitHub, Microsoft, Discord and Twitch sign-in are plugins too, written
				with the same SDK.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="what-a-plugin-can-add">What a plugin can add</h2>

	<p>
		A plugin is a folder: each file in it adds something to Pouchbase, and its place in the folder
		says what (see <a href={resolve('/docs/plugins/project-structure')}>Project structure</a>).
	</p>

	<div class="not-prose grid gap-3 sm:grid-cols-2">
		{#each contributions as contribution (contribution.href)}
			<LinkCard.Root href={contribution.href}>
				<LinkCard.Icon><Icon.Root icon={contribution.icon} /></LinkCard.Icon>

				<LinkCard.Body>
					<LinkCard.Title>
						{contribution.title}
						<Icon.Root icon="lucide:arrow-right" />
					</LinkCard.Title>
					<LinkCard.Description>{contribution.description}</LinkCard.Description>
				</LinkCard.Body>
			</LinkCard.Root>
		{/each}
	</div>

	<h2 id="quick-start">Quick start</h2>

	<h3>1. Create a plugin</h3>

	<p>
		<Code.Root>init</Code.Root> from
		<a href="https://www.npmjs.com/package/@pouchbasejs/plugin-sdk"
			><Code.Root>@pouchbasejs/plugin-sdk</Code.Root></a
		>
		creates a plugin from a template; the directory name becomes the plugin's id:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.init} />
	</CodeBlock.Root>

	<p>
		It asks which template to start from: <Code.Root>field</Code.Root> (a color field type),
		<Code.Root>page</Code.Root> (a dashboard page with a route), <Code.Root>auth-provider</Code.Root
		>
		(an OpenID Connect sign-in provider) or <Code.Root>empty</Code.Root>. Pass it up front with
		<Code.Root>--template</Code.Root>:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.templates} />
	</CodeBlock.Root>

	<h3>2. Run it in Pouchbase</h3>

	<p>
		<Code.Root>pnpm dev</Code.Root> rebuilds the plugin on every change and serves it from a local registry
		on <Code.Root>http://localhost:4510</Code.Root>. Point a Pouchbase on the same machine at it
		with a <a href={resolve('/docs/getting-started')}>server variable</a>:
	</p>

	<CodeBlock.Root title=".env">
		<CodeBlock.Source code={data.code.devRegistry} />
	</CodeBlock.Root>

	<p>
		Then install the plugin from the <strong>Plugins</strong> page of the dashboard, and click
		<strong>Update</strong> after each change.
		<a href={resolve('/docs/plugins/testing')}>Testing and debugging</a> has the details.
	</p>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:cloud" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Server code always runs on Cloudflare</Callout.Title>
			<Callout.Description>
				A plugin with a field type, sign-in provider or route is deployed as a Worker on your
				Cloudflare account, even from a Pouchbase on your machine. The account needs a
				<Code.Root>workers.dev</Code.Root> subdomain. A plugin with only pages deploys nothing.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h3>3. Publish it</h3>

	<p>
		When it works, publish it to the registry, so every Pouchbase can install it from its
		<strong>Plugins</strong> page: see
		<a href={resolve('/docs/plugins/publishing')}>Publishing and updates</a>.
	</p>

	<h2 id="examples">Examples</h2>

	<ul>
		<li>
			The <a href="https://github.com/pouchbase/pouchbase/tree/main/examples/plugin-demo"
				>demo plugin</a
			>
			uses every part of the SDK except sign-in providers, with tests. Samples in these docs marked as
			coming from it are its current code.
		</li>
		<li>
			The built-in sign-in providers in the
			<a href="https://github.com/pouchbase/pouchbase/tree/main/plugins"
				><Code.Root>plugins/</Code.Root> folder</a
			> of the Pouchbase repository are ordinary plugins.
		</li>
	</ul>
</DocsPage>
