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
			'A thumbnail size from the settings of files, such as 100x100, 100x100:fit or 0x100; other sizes return the original',
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
		<a href={resolve('/docs/platform/collections/files')}>files collection</a>. It needs no token:
		files are public to anyone who has their id, and ids are random, so URLs can't be guessed. Use
		the URL as it is in an <Code.Root>&lt;img src&gt;</Code.Root> or a download link.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.download} />
	</CodeBlock.Root>

	<h2 id="parameters">Parameters</h2>

	<DocsTable head={['Parameter', 'Meaning', 'Example']} rows={params} />

	<p>
		Thumbnails are made of PNG, JPEG, GIF and WebP images, for the sizes listed in the settings of
		<Code.Root>files</Code.Root>.
	</p>

	<h2 id="response">The response</h2>

	<p>
		The body is the file itself. PNG, JPEG, GIF, WebP and AVIF images are served inline; every other
		type, and every file with <Code.Root>?download</Code.Root>, as an attachment with its original
		name, so an uploaded HTML or SVG file can never run scripts:
	</p>

	<CodeBlock.Root title="Response headers">
		<CodeBlock.Source code={data.code.headers} />
	</CodeBlock.Root>

	<p>Browsers may cache a file for an hour. Errors are JSON:</p>

	<CodeBlock.Root title="404 Not Found">
		<CodeBlock.Source code={data.code.notFound} />
	</CodeBlock.Root>

	<DocsTable head={['Status', 'Means']} rows={statuses} />

	<h2 id="file-records">File records</h2>

	<p>
		Each file is also a record of <Code.Root>files</Code.Root>, with its
		<Code.Root>name</Code.Root>, <Code.Root>mime_type</Code.Root> and <Code.Root>size</Code.Root>.
		List, get and delete those through the <a href={resolve('/docs/api/records')}>records API</a>,
		at
		<Code.Root>/api/db/files</Code.Root>, as the access rules of <Code.Root>files</Code.Root> allow. Files
		are uploaded in the dashboard; the API doesn't create them.
	</p>
</DocsPage>
