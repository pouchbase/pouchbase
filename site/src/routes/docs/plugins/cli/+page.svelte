<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	const sections: Section[] = [
		{ id: 'commands', title: 'Commands' },
		{ id: 'options', title: 'Options' }
	];

	const commands = [
		{
			command: 'init <dir> [--template <name>]',
			about:
				'Create a plugin from a template: field (default), page, auth-provider or empty. Without --template, it asks in a terminal.'
		},
		{
			command: 'add <field|page|auth-provider|route> <id>',
			about:
				'Create the files of a field type, page, sign-in provider or route, never overwriting any, and add it with its import to plugin.ts.'
		},
		{
			command: 'add setting <key> [--type <type>]',
			about: 'Add a setting to plugin.ts: text (default), secret, number, boolean or url.'
		},
		{
			command: 'dev [--port 4510] [--exact-version]',
			about:
				'Rebuild on every change and serve the plugin from a local registry, as <version>-dev.<n> unless --exact-version.'
		},
		{
			command: 'validate',
			about: 'Check the plugin and compile its components the way Pouchbase does on install.'
		},
		{ command: 'build', about: 'Write the bundle to dist/.' },
		{
			command: 'publish [--registry <url>] [--token <token>]',
			about: 'Check the token, build the plugin and upload it to the registry.'
		},
		{
			command: 'manifest',
			about: 'Print the full manifest the plugin builds into, as JSON.'
		},
		{ command: 'schema', about: 'Print the JSON Schema of the manifest.' }
	];

	const options = [
		{ option: '-q, --quiet', about: 'Print only results, warnings and errors, e.g. in CI.' },
		{
			option: '-v, --verbose',
			about: 'Also print stack traces and every request to the dev registry.'
		},
		{ option: '-h, --help', about: 'Print the commands and options.' },
		{ option: 'NO_COLOR', about: 'An environment variable that turns colors off.' },
		{
			option: 'POUCHBASE_REGISTRY_TOKEN',
			about: 'The publish token, instead of --token.'
		},
		{
			option: 'POUCHBASE_REGISTRY_URL',
			about: 'The registry to publish to, instead of --registry.'
		}
	];
</script>

<DocsPage
	title="CLI reference"
	description="The commands of pouchbase-plugin, from @pouchbasejs/plugin-sdk."
	{sections}
>
	<p>
		Run them with <Code.Root>npx pouchbase-plugin &lt;command&gt;</Code.Root>, or through the
		scripts in the plugin's <Code.Root>package.json</Code.Root>.
	</p>

	<h2 id="commands">Commands</h2>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Command</Table.Head>
				<Table.Head>What it does</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each commands as { command, about } (command)}
				<Table.Row>
					<Table.Cell><Code.Root>{command}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<h2 id="options">Options</h2>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Option</Table.Head>
				<Table.Head>What it does</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each options as { option, about } (option)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{option}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</DocsPage>
