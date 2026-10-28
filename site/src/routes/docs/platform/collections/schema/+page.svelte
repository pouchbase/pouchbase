<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import DocsPage, { type Section } from '../../../docs-page.svelte';

	const sections: Section[] = [
		{ id: 'export', title: 'Export' },
		{ id: 'import', title: 'Import' },
		{ id: 'from-code', title: 'From code' }
	];
</script>

<DocsPage
	title="Export and import"
	description="Copy collections with their fields, indexes and access rules to another instance, for example from development to production, without their records."
	{sections}
>
	<h2 id="export">Export</h2>

	<p>
		<strong>Export</strong>, in the menu next to <strong>Collections</strong> in the sidebar, downloads
		the collections you pick as JSON: fields, indexes, access rules and settings, no records. Relations
		to collections you didn't pick are kept by name, so the file imports where those exist.
	</p>

	<h2 id="import">Import</h2>

	<p>
		<strong>Import</strong>, in the same menu, creates the collections of an export file and changes
		existing ones to match, matched by id, then by name. Records are left alone. The dialog first
		lists every change, marking the ones that remove data:
	</p>

	<ul>
		<li>
			Other collections stay, unless you tick <strong
				>Also delete the collections that are not in the file</strong
			>; built-in collections always stay.
		</li>
		<li>Changes that delete collections, fields or records only run once you confirm them.</li>
		<li>
			A file whose relations point to missing collections, or whose fields use a plugin's type that
			isn't installed, can't be imported.
		</li>
	</ul>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:database-backup" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Back up before removing data</Callout.Title>
			<Callout.Description>
				A field or collection that an import deletes takes its data with it.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="from-code">From code</h2>

	<p>
		A deploy script can change collections with an
		<a href={resolve('/docs/platform/api-keys')}>API key</a>:
		<a href={resolve('/docs/sdk/schema')}><Code.Root>pouch.schema</Code.Root></a> in the JS SDK, or
		the
		<a href={resolve('/docs/api/schema')}>schema endpoints</a> of the REST API.
	</p>
</DocsPage>
