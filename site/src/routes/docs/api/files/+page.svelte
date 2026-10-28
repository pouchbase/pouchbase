<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'get-a-file', title: 'Get a file' },
		{ id: 'parameters', title: 'Parameters' },
		{ id: 'response', title: 'The response' },
		{ id: 'file-records', title: 'File records' }
	];

	const params = [
		[
			'size',
			'A thumbnail size from the settings of files: WxH, WxH:top, WxH:bottom, WxH:fit, Wx0 or 0xH; other sizes return the original',
			'400x300'
		],
		['download', 'Serve the file as a download, also for images; takes no value', '(none)']
	];

	const statuses = [
		['200', 'The file, or its thumbnail'],
		['404', 'There is no file with this id'],
		['500', 'The file couldn’t be loaded from the storage']
	];
</script>

<DocsPage
	title="Files"
	description="Load an uploaded file, or a thumbnail of an image, from its URL; and list and delete file records through the records API."
	{sections}
>
	<h2 id="get-a-file">Get a file</h2>

	<p>
		<Code.Root>GET /api/files/&lt;id&gt;</Code.Root> serves a file of the built-in
		<a href={resolve('/docs/platform/collections/files')}>files collection</a>, without a token: ids
		are random, so anyone with the URL can load the file, but nobody can guess it.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.download} />
	</CodeBlock.Root>

	<h2 id="parameters">Parameters</h2>

	<DocsTable head={['Parameter', 'Meaning', 'Example']} rows={params} />

	<p>Thumbnails are made of PNG, JPEG, GIF and WebP images.</p>

	<h2 id="response">The response</h2>

	<p>
		PNG, JPEG, GIF, WebP and AVIF images are served inline. Every other type, and any file with
		<Code.Root>?download</Code.Root>, is an <Code.Root>application/octet-stream</Code.Root> attachment
		with its original name, so an uploaded HTML or SVG file can't run scripts. Browsers may cache it for
		an hour:
	</p>

	<CodeBlock.Root title="Response headers">
		<CodeBlock.Source code={data.code.headers} />
	</CodeBlock.Root>

	<CodeBlock.Root title="404 Not Found">
		<CodeBlock.Source code={data.code.notFound} />
	</CodeBlock.Root>

	<DocsTable head={['Status', 'Means']} rows={statuses} />

	<h2 id="file-records">File records</h2>

	<p>
		Each file is also a record of <Code.Root>files</Code.Root>, with its
		<Code.Root>name</Code.Root>, <Code.Root>mime_type</Code.Root> and <Code.Root>size</Code.Root>.
		List, get and delete them through the <a href={resolve('/docs/api/records')}>records API</a> at
		<Code.Root>/api/db/files</Code.Root>. Files are uploaded in the dashboard; the API doesn't
		create them.
	</p>
</DocsPage>
