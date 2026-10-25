<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'define-settings', title: 'Define settings' },
		{ id: 'read-settings', title: 'Read settings' }
	];

	const settingKeys = [
		{
			key: 'key',
			about: 'How the code reads it. Lowercase letters, numbers and underscores; unique.'
		},
		{ key: 'label', about: 'Its name in the settings form.' },
		{ key: 'description', about: 'One sentence under the field (optional).' },
		{
			key: 'type',
			about:
				'text (default), secret (never shown again once saved), number, boolean or url (an absolute URL).'
		},
		{
			key: 'required',
			about:
				'The dashboard marks the plugin “Needs settings” until an admin saves it. Default false.'
		},
		{
			key: 'default',
			about: 'Used while nothing is saved. A secret has no default.'
		}
	];
</script>

<DocsPage
	title="Settings"
	description="Typed values an admin fills in on the Plugins page, such as an API key or a region."
	{sections}
>
	<h2 id="define-settings">Define settings</h2>

	<p>
		Settings are the <Code.Root>settings</Code.Root> list of
		<Code.Root>definePlugin(&#123; … &#125;)</Code.Root> in <Code.Root>plugin.ts</Code.Root>, next
		to what else the plugin adds; Pouchbase builds the settings form from it. They are code, so
		<Code.Root>pouchbase-plugin.json</Code.Root> can't have them. The <Code.Root>Register</Code.Root
		> block at the end types <Code.Root>ctx.settings</Code.Root>
		everywhere in the plugin.
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.setting} />
	</CodeBlock.Root>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Key</Table.Head>
				<Table.Head>What it is</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each settingKeys as { key, about } (key)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{key}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		<Code.Root>add setting</Code.Root> writes one for you, creating <Code.Root>plugin.ts</Code.Root> when
		needed:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.addSetting} />
	</CodeBlock.Root>

	<h2 id="read-settings">Read settings</h2>

	<p>
		<Code.Root>ctx.settings.get(key)</Code.Root> returns a promise of the saved value, else the default,
		else <Code.Root>null</Code.Root>. A <Code.Root>number</Code.Root> setting gives a number, a <Code.Root
			>boolean</Code.Root
		> a boolean, the others a string.
	</p>

	<CodeBlock.Root title="routes/status.ts">
		<CodeBlock.Source code={data.code.readSetting} />
	</CodeBlock.Root>

	<ul>
		<li>
			Only a setting with a default is never <Code.Root>null</Code.Root>. A required setting without
			one is <Code.Root>null</Code.Root> until an admin saves it, so handle that.
		</li>
		<li>
			Settings aren't copied between instances, such as from staging to production, since they may
			hold secrets.
		</li>
		<li>
			Renaming or removing a setting loses its saved value: the new key starts empty, or at its
			default.
		</li>
	</ul>
</DocsPage>
