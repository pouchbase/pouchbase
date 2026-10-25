<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'file-urls', title: 'File URLs' },
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
	description="Turn the ids in file fields into URLs for images, thumbnails and downloads with pouch.files.url()."
	{sections}
>
	<h2 id="file-urls">File URLs</h2>

	<p>
		File fields hold the ids of records in the
		<a href={resolve('/docs/platform/collections/files')}>files collection</a>.
		<Code.Root>pouch.files.url()</Code.Root> takes such an id, or a file record from
		<a href="{resolve('/docs/sdk/records')}#relations">include</a>, and returns the URL to put in an
		<Code.Root>&lt;img src&gt;</Code.Root> or a download link. It makes no request.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.fileUrls} />
	</CodeBlock.Root>

	<p>
		<Code.Root>download: true</Code.Root> serves the file as a download. Without it, only PNG, JPEG, GIF,
		WebP and AVIF images are shown inline; other types are downloaded anyway.
	</p>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:eye" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Files are public</Callout.Title>
			<Callout.Description>
				Anyone with the URL of a file can load it, without a token. Ids are random, so URLs can't be
				guessed.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="thumbnails">Thumbnails</h2>

	<p>
		<Code.Root>size</Code.Root> asks for a thumbnail, as width by height. Only the sizes listed in the
		settings of the files collection are made; for any other size, the original file is returned.
	</p>

	<DocsTable head={['size', 'Thumbnail']} rows={sizes} />
</DocsPage>
