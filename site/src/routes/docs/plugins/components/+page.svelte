<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'imports', title: 'Imports' },
		{ id: 'styling', title: 'Styling' },
		{ id: 'icons', title: 'Icons' }
	];

	// HOST_MODULE_IDS of @pouchbasejs/plugin-sdk/ui, without svelte/internal/*, which only the
	// compiled components import.
	const hostModules = [
		{
			group: 'Svelte',
			modules: [
				'svelte',
				'svelte/store',
				'svelte/transition',
				'svelte/animate',
				'svelte/easing',
				'svelte/motion',
				'svelte/reactivity',
				'svelte/events',
				'svelte/attachments'
			]
		},
		{ group: 'Plugin SDK', modules: ['@pouchbasejs/plugin-sdk/ui'] },
		{
			group: 'Dashboard components',
			modules: [
				'@pouchbasejs/ui',
				'@pouchbasejs/ui/badge',
				'@pouchbasejs/ui/button',
				'@pouchbasejs/ui/callout',
				'@pouchbasejs/ui/card',
				'@pouchbasejs/ui/empty',
				'@pouchbasejs/ui/icon',
				'@pouchbasejs/ui/link',
				'@pouchbasejs/ui/meter',
				'@pouchbasejs/ui/progress',
				'@pouchbasejs/ui/scroll-area',
				'@pouchbasejs/ui/segmented',
				'@pouchbasejs/ui/skeleton',
				'@pouchbasejs/ui/spinner',
				'@pouchbasejs/ui/swatch',
				'@pouchbasejs/ui/table',
				'@pouchbasejs/ui/thumbnail',
				'@pouchbasejs/ui/tile',
				'@pouchbasejs/ui/tooltip',
				'@pouchbasejs/ui/inputs/checkbox',
				'@pouchbasejs/ui/inputs/input',
				'@pouchbasejs/ui/inputs/select',
				'@pouchbasejs/ui/inputs/slider',
				'@pouchbasejs/ui/inputs/textarea'
			]
		}
	];
</script>

<DocsPage
	title="Components and icons"
	description="What the Svelte components of a plugin (inputs, previews and pages) may import, how to style them, and how to give field types and pages an icon."
	{sections}
>
	<p>
		Pouchbase compiles a plugin's <Code.Root>.svelte</Code.Root> files with its own Svelte compiler when
		the plugin is installed, and renders them in the dashboard, in the browser only. A component that
		fails while rendering shows an error in its place instead of breaking the page.
		<Code.Root>pouchbase-plugin validate</Code.Root> compiles them the same way, so you see compile errors
		before installing.
	</p>

	<h2 id="imports">Imports</h2>

	<p>
		A component or module may import, with static <Code.Root>import</Code.Root> statements only:
	</p>

	<ul>
		<li>
			other <Code.Root>.svelte</Code.Root>, <Code.Root>.ts</Code.Root> and <Code.Root>.js</Code.Root
			>
			files of the plugin, by relative path;
		</li>
		<li>these modules, which Pouchbase provides in the versions the dashboard uses:</li>
	</ul>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>From</Table.Head>
				<Table.Head>Modules</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each hostModules as { group, modules } (group)}
				<Table.Row>
					<Table.Cell class="whitespace-nowrap">{group}</Table.Cell>
					<Table.Cell>
						{#each modules as module, index (module)}
							<Code.Root>{module}</Code.Root>{index < modules.length - 1 ? ', ' : ''}
						{/each}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<ul>
		<li>
			Nothing else: no other npm packages, no dynamic <Code.Root>import()</Code.Root>. Install
			<Code.Root>svelte</Code.Root> and <Code.Root>@pouchbasejs/ui</Code.Root> as devDependencies for
			type checking only (the templates do).
		</li>
		<li>
			Import TypeScript files by their <Code.Root>.js</Code.Root> name:
			<Code.Root>../../lib/colors.js</Code.Root> for <Code.Root>lib/colors.ts</Code.Root>.
		</li>
		<li>
			Server files (<Code.Root>field.ts</Code.Root>, <Code.Root>provider.ts</Code.Root>,
			<Code.Root>routes/</Code.Root>, <Code.Root>plugin.ts</Code.Root>) can't be imported: move what
			both need into <Code.Root>lib/</Code.Root>.
		</li>
		<li>
			Only JavaScript is linked: inline JSON data in a <Code.Root>.ts</Code.Root> module and SVG markup
			in a component or a string.
		</li>
	</ul>

	<h2 id="styling">Styling</h2>

	<ul>
		<li>
			Use Tailwind classes, as the dashboard does. The CLI compiles the classes you use, with the
			dashboard's design tokens (<Code.Root>h-control</Code.Root>, <Code.Root>h-row</Code.Root>, …),
			so a class means the same as in the dashboard.
		</li>
		<li>
			Or use the component's <Code.Root>&lt;style&gt;</Code.Root>, which is scoped to it and can't
			break the dashboard.
		</li>
	</ul>

	<h2 id="icons">Icons</h2>

	<p>
		Field types and pages get an icon in the dashboard, drawn like its built-in icons: in the text
		color, at 16 pixels. Only the shape counts, so monochrome icons work best. Without one, they
		show a puzzle piece.
	</p>

	<CodeBlock.Root title="fields/*/field.ts">
		<CodeBlock.Source code={data.code.icons} />
	</CodeBlock.Root>

	<ul>
		<li>
			An <a href="https://icon-sets.iconify.design">Iconify</a> name, such as
			<Code.Root>lucide:palette</Code.Root>, becomes an SVG file of the bundle when the CLI builds,
			so Pouchbase never fetches it. <Code.Root>lucide</Code.Root> comes with the SDK; for another set,
			install <Code.Root>@iconify-json/&lt;set&gt;</Code.Root>.
		</li>
		<li>
			A path is an <Code.Root>.svg</Code.Root> file of the plugin, relative to the file that names it.
			Without <Code.Root>icon</Code.Root>, the CLI uses <Code.Root
				>fields/&lt;type&gt;/icon.svg</Code.Root
			>
			or <Code.Root>pages/&lt;path&gt;.svg</Code.Root> when there is one.
		</li>
		<li>
			Icons are plain SVG of at most 32 KiB: no scripts, event handlers or external references.
		</li>
	</ul>

	<h3>Icons inside a component</h3>

	<p>
		Use <Code.Root>Icon.Root</Code.Root> from <Code.Root>@pouchbasejs/ui/icon</Code.Root> with
		<Code.Root>src</Code.Root>: a <Code.Root>data:</Code.Root> URL, or an icon of one of the plugin's
		field types or pages, which Pouchbase serves. Avoid <Code.Root>icon="lucide:…"</Code.Root>:
		names the dashboard doesn't bundle itself are fetched from the Iconify API, so they show late,
		or not at all offline.
	</p>

	<CodeBlock.Root title="pages/palette.svelte">
		<CodeBlock.Source code={data.code.iconSrc} />
	</CodeBlock.Root>
</DocsPage>
