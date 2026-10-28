<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'pouchbase-error', title: 'PouchbaseError' },
		{ id: 'kinds', title: 'Kinds' },
		{ id: 'without-try-catch', title: 'Without try/catch' }
	];

	const properties = [
		['kind', 'What went wrong, from the status; see Kinds'],
		['status', 'The HTTP status, or 0 when no response was received'],
		['message', 'A message in English, from the API where it gives one'],
		['issues', 'A message per field, for invalid and conflict errors; {} otherwise'],
		['code', 'A reason where the API gives one, such as email_not_verified; "" otherwise'],
		['data', 'The parsed response body, if any'],
		['cause', 'The original error, for network errors']
	];

	const kinds = [
		['network', '0', 'No response: offline, a CORS or DNS problem'],
		['invalid', '400', 'Invalid input; issues has a message per field'],
		['unauthorized', '401', 'A missing, invalid or expired token or API key'],
		['forbidden', '403', 'Not allowed, for example by a locked access rule'],
		['not_found', '404', 'Doesn’t exist, or an access rule hides it'],
		['conflict', '409', 'A unique value is taken; issues names the field'],
		['server', '5xx', 'Something went wrong on the server'],
		['unknown', 'other', 'Any other status, such as 422']
	];
</script>

<DocsPage
	title="Errors"
	description="Every failed call of the SDK throws a PouchbaseError with a kind, the HTTP status, a message and a message per field; .safe() returns it instead."
	{sections}
>
	<h2 id="pouchbase-error">PouchbaseError</h2>

	<p>
		Every failed request (no response, or a status other than 2xx) throws a
		<Code.Root>PouchbaseError</Code.Root>. <Code.Root>isPouchbaseError(error, kind?)</Code.Root>
		checks for one, optionally of one kind, and narrows its type:
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.errors} />
	</CodeBlock.Root>

	<DocsTable head={['Property', 'Holds']} rows={properties} />

	<h2 id="kinds">Kinds</h2>

	<DocsTable head={['Kind', 'Status', 'When']} rows={kinds} />

	<p>
		See also <a href="{resolve('/docs/sdk/records')}#errors">Records</a> and the
		<a href={resolve('/docs/api/introduction')}>REST API</a> pages.
	</p>

	<h2 id="without-try-catch">Without try/catch</h2>

	<p>
		The calls of <Code.Root>pouch.db</Code.Root> (all but <Code.Root>iterate()</Code.Root>) also
		have <Code.Root>.safe()</Code.Root>, which returns <Code.Root>{'{ ok: true, data }'}</Code.Root>
		or <Code.Root>{'{ ok: false, error }'}</Code.Root> instead of throwing. On
		<Code.Root>insert()</Code.Root> and <Code.Root>patch()</Code.Root>, <Code.Root>issues</Code.Root
		> is typed by the fields of the collection, which suits forms.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.safe} />
	</CodeBlock.Root>
</DocsPage>
