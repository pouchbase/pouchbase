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
		{ id: 'the-server-side', title: 'The server side' },
		{ id: 'the-input', title: 'The input' },
		{ id: 'the-preview', title: 'The preview' },
		{ id: 'stored-data', title: 'Stored data' }
	];
</script>

<DocsPage
	title="Field types"
	description="Add a type for collection fields: how it is validated and stored on the server, edited in the record form and shown in the records grid."
	{sections}
>
	<p>
		A field type is a <Code.Root>defineField(...)</Code.Root> in <Code.Root>fields</Code.Root> of
		<Code.Root>definePlugin</Code.Root>; its key is the type, so <Code.Root>color</Code.Root> is
		<Code.Root>&lt;plugin&gt;:color</Code.Root>:
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.fieldPlugin} />
	</CodeBlock.Root>

	<p>
		The templates keep each type in a folder of its own, such as <Code.Root>fields/color/</Code.Root
		>, but any file works.
	</p>

	<h2 id="the-server-side">The server side</h2>

	<p>
		<Code.Root>field.ts</Code.Root> default-exports <Code.Root>defineField(...)</Code.Root>, which
		names the components it imports:
	</p>

	<CodeBlock.Root title="fields/color/field.ts">
		<CodeBlock.Source code={data.code.field} />
	</CodeBlock.Root>

	<ul>
		<li>
			<Code.Root>label</Code.Root> and <Code.Root>description</Code.Root> are shown when an admin picks
			a type.
		</li>
		<li>
			<Code.Root>column</Code.Root> is the SQLite column type: <Code.Root>TEXT</Code.Root>,
			<Code.Root>INTEGER</Code.Root>, <Code.Root>REAL</Code.Root> or <Code.Root>BLOB</Code.Root>. It
			is fixed when a field is created; changing it later only affects new fields.
		</li>
		<li>
			<Code.Root>input</Code.Root> (required) and <Code.Root>preview</Code.Root> (optional) are Svelte
			components, imported like modules; <Code.Root>icon</Code.Root> is an Iconify name or an imported
			<Code.Root>.svg</Code.Root> file (see
			<a href="{resolve('/docs/plugins/components')}#icons">Icons</a>).
		</li>
		<li>
			<Code.Root>validate(value, options, ctx)</Code.Root> checks a value before it is saved. Values from
			the record form are strings, but the API may send any JSON, so accept both.
		</li>
		<li>
			<Code.Root>serialize(value, ctx)</Code.Root> turns a valid value into what is stored;
			<Code.Root>deserialize(value, ctx)</Code.Root> turns the stored value into what the API returns.
		</li>
		<li>
			All hooks are optional. Empty values are stored as <Code.Root>null</Code.Root> without calling the
			plugin, and a field's default value goes through <Code.Root>validate</Code.Root> and
			<Code.Root>serialize</Code.Root> too.
		</li>
		<li>
			The CLI reads the label, description, column, components and icon by running
			<Code.Root>plugin.ts</Code.Root> in Node.js, so keep the top level of
			<Code.Root>field.ts</Code.Root> free of anything only a Worker has. The hooks run in the plugin's
			<a href="{resolve('/docs/plugins/routes')}#server-code">Worker</a>.
		</li>
	</ul>

	<h2 id="the-input">The input</h2>

	<p>
		The <Code.Root>input</Code.Root> component gets <Code.Root>FieldInputProps</Code.Root> and must submit
		the value with a form control named <Code.Root>name</Code.Root>. Use a hidden
		<Code.Root>&lt;input&gt;</Code.Root> when something else edits it:
	</p>

	<CodeBlock.Root title="fields/color/input.svelte">
		<CodeBlock.Source code={data.code.fieldInput} />
	</CodeBlock.Root>

	<p>
		<a href={resolve('/docs/plugins/ui/[component=slug]', { component: 'input' })}>Input</a> comes
		from
		<Code.Root>@pouchbasejs/ui</Code.Root>, so the input looks like the dashboard's own; see
		<a href={resolve('/docs/plugins/ui')}>UI components</a> for the others.
	</p>

	<h2 id="the-preview">The preview</h2>

	<p>
		The <Code.Root>preview</Code.Root> component shows the value, read-only, in the records grid. It gets
		<Code.Root>FieldPreviewProps</Code.Root>; without one, the grid shows the value as text.
	</p>

	<CodeBlock.Root title="fields/color/preview.svelte">
		<CodeBlock.Source code={data.code.fieldPreview} />
	</CodeBlock.Root>

	<p>
		What components may import and how to style them is in
		<a href={resolve('/docs/plugins/components')}>Components and icons</a>.
	</p>

	<h2 id="stored-data">Stored data</h2>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:database" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Removing a plugin keeps the data</Callout.Title>
			<Callout.Description>
				The fields of its types stay, with their data, but become read-only until the plugin is
				installed again.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<ul>
		<li>
			Never rename a field type once people use it: the fields of the old name become read-only, as
			if the plugin were removed.
		</li>
		<li>
			Changing <Code.Root>serialize</Code.Root> only affects values saved from then on. Stored values
			are never rewritten, so <Code.Root>deserialize</Code.Root> and the preview must keep reading the
			old form.
		</li>
	</ul>
</DocsPage>
