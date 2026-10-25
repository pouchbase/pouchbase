<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../../docs-page.svelte';
	import InlineText from '../inline-text.svelte';
	import ComponentExample from './component-example.svelte';

	let { data }: PageProps = $props();

	const component = $derived(data.component);

	const sections: Section[] = $derived([
		{ id: 'import', title: 'Import' },
		...data.examples.map((example) => ({ id: example.id, title: example.title })),
		{ id: 'api-reference', title: 'API reference' }
	]);
</script>

<DocsPage title={component.title} description={component.description} {sections}>
	{#each component.about ?? [] as paragraph (paragraph)}
		<p><InlineText text={paragraph} /></p>
	{/each}

	<h2 id="import">Import</h2>

	<p>
		Import the component from its own entry point, or as <Code.Root
			>{`{ ${component.name} }`}</Code.Root
		>
		from <a href={resolve('/docs/plugins/ui')}><Code.Root>@pouchbasejs/ui</Code.Root></a>.
	</p>

	<CodeBlock.Root>
		<CodeBlock.Source code={data.importCode} />
	</CodeBlock.Root>

	<h2>Examples</h2>

	{#each data.examples as example (example.id)}
		<h3 id={example.id}>{example.title}</h3>

		{#if example.description}
			<p><InlineText text={example.description} /></p>
		{/if}

		<ComponentExample preview={example.preview} code={example.code} title="{example.id}.svelte" />
	{/each}

	<h2 id="api-reference">API reference</h2>

	{#each component.parts as part (part.name)}
		<h3 id="{component.slug}-{part.name.toLowerCase()}">
			<Code.Root>{component.name}.{part.name}</Code.Root>
		</h3>

		<p>
			<InlineText text={part.description} />

			{#if part.element}
				It also takes <Code.Root>class</Code.Root> and the attributes of
				<Code.Root>{part.element}</Code.Root>.
			{/if}
		</p>

		{#if part.props?.length}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Prop</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each part.props as prop (prop.name)}
						<Table.Row>
							<Table.Cell class="whitespace-nowrap"><Code.Root>{prop.name}</Code.Root></Table.Cell>
							<Table.Cell><Code.Root>{prop.type}</Code.Root></Table.Cell>
							<Table.Cell class="whitespace-nowrap">
								{#if prop.default}
									<Code.Root>{prop.default}</Code.Root>
								{:else}
									<span class="text-zinc-400">–</span>
								{/if}
							</Table.Cell>
							<Table.Cell><InlineText text={prop.description} /></Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	{/each}
</DocsPage>
