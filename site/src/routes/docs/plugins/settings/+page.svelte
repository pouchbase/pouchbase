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
			about: 'Lowercase letters, numbers and underscores; unique.'
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
			about: 'The dashboard marks the plugin “Needs settings” until an admin saves it.'
		},
		{
			key: 'default',
			about: 'Used while nothing is saved, of the setting’s type. Not for secret.'
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
		Settings are the <Code.Root>settings</Code.Root> list of <Code.Root>definePlugin</Code.Root>;
		Pouchbase builds the settings form from it. The <Code.Root>Register</Code.Root> block types
		<Code.Root>ctx.settings</Code.Root> everywhere in the plugin.
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
		<Code.Root>add setting</Code.Root> writes one for you:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.addSetting} />
	</CodeBlock.Root>

	<h2 id="read-settings">Read settings</h2>

	<p>
		<Code.Root>ctx.settings.get(key)</Code.Root> resolves to the saved value, else the default, else
		<Code.Root>null</Code.Root>: a number for a <Code.Root>number</Code.Root> setting, a boolean for a
		<Code.Root>boolean</Code.Root>, else a string.
	</p>

	<CodeBlock.Root title="routes/status.ts">
		<CodeBlock.Source code={data.code.readSetting} />
	</CodeBlock.Root>

	<ul>
		<li>
			Only a setting with a default is never <Code.Root>null</Code.Root>; a required one without a
			default is <Code.Root>null</Code.Root> until an admin saves it.
		</li>
		<li>Settings aren't copied between environments, such as from staging to production.</li>
		<li>Renaming or removing a setting loses its saved value.</li>
	</ul>
</DocsPage>
