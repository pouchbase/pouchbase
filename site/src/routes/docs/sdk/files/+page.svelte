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
		File fields hold ids of records in the
		<a href={resolve('/docs/platform/collections/files')}>files collection</a>.
		<Code.Root>pouch.files.url()</Code.Root> turns such an id, or a file record from
		<a href="{resolve('/docs/sdk/records')}#relations">include</a>, into a URL, without a request.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.fileUrls} />
	</CodeBlock.Root>

	<p>
		Only PNG, JPEG, GIF, WebP and AVIF images are shown inline; other types are always downloaded.
	</p>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:eye" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Files are public</Callout.Title>
			<Callout.Description>
				Anyone with the URL can load a file, without a token. Ids are random, so URLs can't be
				guessed.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="thumbnails">Thumbnails</h2>

	<p>
		Only the sizes listed in the settings of the files collection are made; any other
		<Code.Root>size</Code.Root> returns the original file.
	</p>

	<DocsTable head={['size', 'Thumbnail']} rows={sizes} />
</DocsPage>
