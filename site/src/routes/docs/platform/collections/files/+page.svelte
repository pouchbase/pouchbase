<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../../docs-page.svelte';
	import DocsTable from '../../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'the-files-collection', title: 'The files collection' },
		{ id: 'file-fields', title: 'File fields' },
		{ id: 'urls', title: 'File URLs' },
		{ id: 'thumbnails', title: 'Thumbnails' }
	];

	const sizes = [
		['100x100', 'Cropped to 100 by 100 pixels, from the center'],
		['100x100:top', 'Cropped from the top'],
		['100x100:bottom', 'Cropped from the bottom'],
		['100x100:fit', 'Fitted within 100 by 100, without cropping'],
		['100x0', '100 pixels wide, with the height to scale'],
		['0x100', '100 pixels high, with the width to scale']
	];
</script>

<DocsPage
	title="Files"
	description="Uploads are records of the built-in files collection, linked to other records by file fields and served with thumbnails from their own URL."
	{sections}
>
	<h2 id="the-files-collection">The files collection</h2>

	<p>
		Every upload is a record of the built-in <Code.Root>files</Code.Root> collection, and its content
		is stored in R2 or in an S3-compatible bucket of your choice. Files are uploaded in the dashboard:
		in a file field of the record form, or on the page of the files collection. A record of
		<Code.Root>files</Code.Root> looks like this:
	</p>

	<CodeBlock.Root title="Response">
		<CodeBlock.Source code={data.code.fileRecord} />
	</CodeBlock.Root>

	<p>
		<Code.Root>mime_type</Code.Root> and <Code.Root>size</Code.Root> (in bytes) are set by Pouchbase,
		and <Code.Root>thumbnails</Code.Root> lists the thumbnail sizes made so far. The records API can list,
		view and delete files, following the
		<a href={resolve('/docs/platform/collections/access-rules')}>access rules</a> of
		<Code.Root>files</Code.Root>, but not create them.
	</p>

	<h2 id="file-fields">File fields</h2>

	<p>
		A <strong>File</strong> field links a record to files: it holds the id of a file, or an array of
		ids when it allows several. It can limit the file types, by MIME type, wildcard or extension (<Code.Root
			>image/*</Code.Root
		>, <Code.Root>.pdf</Code.Root>), and set a maximum size of up to 10 MB. <Code.Root
			>include</Code.Root
		> returns the file records instead of their ids, as for a
		<a href="{resolve('/docs/sdk/records')}#relations">relation</a>.
	</p>

	<h2 id="urls">File URLs</h2>

	<p>
		Every file has a URL of its own, <Code.Root>/api/files/&lt;id&gt;</Code.Root>, to put in an
		<Code.Root>&lt;img src&gt;</Code.Root> or a download link. <Code.Root>?size=400x300</Code.Root> asks
		for a <a href="#thumbnails">thumbnail</a>, and <Code.Root>?download</Code.Root> serves any file as
		a download. Build the URL with
		<a href={resolve('/docs/sdk/files')}><Code.Root>pouch.files.url()</Code.Root></a> in the JS SDK,
		or see <a href={resolve('/docs/api/files')}>Files</a> in the REST API.
	</p>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:eye" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Files are public</Callout.Title>
			<Callout.Description>
				Anyone with the URL of a file can load it; the access rules only decide who can find its id.
				Ids are random, so URLs can't be guessed. Don't use files for what must stay secret.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<p>
		Only PNG, JPEG, GIF, WebP and AVIF images are shown inline; every other type is downloaded, so
		an uploaded HTML or SVG file can never run scripts.
	</p>

	<h2 id="thumbnails">Thumbnails</h2>

	<p>
		Thumbnails are made for the sizes listed in the settings of <Code.Root>files</Code.Root>, as
		width by height. A size that isn't listed returns the original file.
	</p>

	<DocsTable head={['Size', 'Thumbnail']} rows={sizes} />
</DocsPage>
