<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as LinkCard from '#lib/components/ui/link-card/index.js';
	import { uiCategories, uiComponents } from '#lib/ui-components.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'components', title: 'Components' },
		{ id: 'install', title: 'Install' },
		{ id: 'setup', title: 'Setup' },
		{ id: 'usage', title: 'Usage' },
		{ id: 'in-a-plugin', title: 'In a plugin' },
		{ id: 'versioning', title: 'Versioning' }
	];
</script>

<DocsPage
	title="UI components"
	description="The Svelte components the Pouchbase dashboard is built with: buttons, inputs, cards, tables, tooltips and more, for plugins and for your own apps."
	{sections}
>
	<p>
		<Code.Root>@pouchbasejs/ui</Code.Root> (MIT) holds the primitives of the dashboard, built on
		<a href="https://svelte.dev">Svelte 5</a>, <a href="https://bits-ui.com">bits-ui</a>,
		<a href="https://iconify.design">Iconify</a> and
		<a href="https://tailwindcss.com">Tailwind CSS 4</a>. A
		<a href={resolve('/docs/plugins')}>plugin</a> uses them to look like the rest of the dashboard; an
		app can install them like any other package.
	</p>

	<h2 id="components">Components</h2>

	<p>Every page shows the component live, with its source and its props.</p>

	{#each uiCategories as category (category.id)}
		<h3>{category.title}</h3>

		<div class="not-prose my-4 grid gap-3 sm:grid-cols-2">
			{#each uiComponents.filter((component) => component.category === category.id) as component (component.slug)}
				<LinkCard.Root
					href={resolve('/docs/plugins/ui/[component=slug]', { component: component.slug })}
					class="gap-1.5 p-4"
				>
					<LinkCard.Title>
						{component.title}
						<Icon.Root icon="lucide:arrow-right" />
					</LinkCard.Title>
					<LinkCard.Description>{component.description}</LinkCard.Description>
				</LinkCard.Root>
			{/each}
		</div>
	{/each}

	<h2 id="install">Install</h2>

	<p>
		In an app, install the package with its peer dependencies (a plugin doesn't: see <a
			href="#in-a-plugin">In a plugin</a
		>).
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.install} />
	</CodeBlock.Root>

	<h2 id="setup">Setup</h2>

	<p>
		Import the theme after Tailwind in your global stylesheet. It holds the design tokens (<Code.Root
			>h-control</Code.Root
		>, <Code.Root>h-row</Code.Root>, chart colors, animations) and the base styles, and tells
		Tailwind to generate the classes the components use;
		<Code.Root>@pouchbasejs/ui/tokens.css</Code.Root> holds only the tokens.
	</p>

	<CodeBlock.Root title="src/app.css">
		<CodeBlock.Source code={data.code.theme} />
	</CodeBlock.Root>

	<p>
		The components follow the system's color scheme; <Code.Root>data-theme="light"</Code.Root> or
		<Code.Root>data-theme="dark"</Code.Root> on <Code.Root>&lt;html&gt;</Code.Root> overrides it, and
		a <Code.Root>dark:</Code.Root> variant follows the same rules.
	</p>

	<p>
		Add the Iconify Vite plugin. It bundles only the icons your sources and the components use, so
		icons render on the server and are never fetched from the Iconify API:
	</p>

	<CodeBlock.Root title="vite.config.ts">
		<CodeBlock.Source code={data.code.viteConfig} />
	</CodeBlock.Root>

	<p>Register the icons once, in your root layout:</p>

	<CodeBlock.Root title="src/routes/+layout.svelte">
		<CodeBlock.Source code={data.code.layout} />
	</CodeBlock.Root>

	<p>For TypeScript, declare the virtual module:</p>

	<CodeBlock.Root title="src/virtual.d.ts">
		<CodeBlock.Source code={data.code.virtualModule} />
	</CodeBlock.Root>

	<h2 id="usage">Usage</h2>

	<p>
		Every component is a set of parts used through a namespace, with a <Code.Root>Root</Code.Root> part.
		Import a component from its own entry point, or all of them from the package root. Parts take
		<Code.Root>class</Code.Root>, merged with their own classes.
	</p>

	<CodeBlock.Root title="backups.svelte">
		<CodeBlock.Source code={data.code.usage} />
	</CodeBlock.Root>

	<p>
		Icon names must appear literally in the source, as in <Code.Root>icon="lucide:plus"</Code.Root>,
		so the Vite plugin can find them. See
		<a href={resolve('/docs/plugins/ui/[component=slug]', { component: 'icon' })}>Icon</a> for SVG files.
	</p>

	<h2 id="in-a-plugin">In a plugin</h2>

	<p>
		The dashboard provides the components at runtime, in its own version, so a plugin skips the
		install and setup above:
	</p>

	<ul>
		<li>
			it installs <Code.Root>@pouchbasejs/ui</Code.Root> 0.2 or later as a devDependency, for type checking
			and the dashboard's tokens (the templates do), and never bundles it,
			<Code.Root>bits-ui</Code.Root> or <Code.Root>@iconify/svelte</Code.Root>;
		</li>
		<li>
			it needs no Vite plugin, <Code.Root>virtual:iconify</Code.Root> or
			<Code.Root>theme.css</Code.Root>: the plugin CLI compiles its Tailwind classes with the
			dashboard's tokens;
		</li>
		<li>
			<Code.Root>Icon.Root icon="lucide:…"</Code.Root> only renders at once the icons the dashboard bundles
			for itself, so use <Code.Root>src</Code.Root> with an SVG URL instead.
		</li>
	</ul>

	<p>
		See <a href={resolve('/docs/plugins/components')}>Components and icons</a> for what a plugin may import.
	</p>

	<h2 id="versioning">Versioning</h2>

	<p>
		Component names, parts and props are part of the plugin API: within an API version they only
		change in a backwards compatible way, with new components, parts, props or variants.
	</p>
</DocsPage>
