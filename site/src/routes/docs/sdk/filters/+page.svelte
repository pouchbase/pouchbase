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
		{ id: 'where', title: 'The where object' },
		{ id: 'comparisons', title: 'Comparisons per field' },
		{ id: 'what-is-sent', title: 'What is sent' },
		{ id: 'writing-conditions', title: 'Writing conditions by hand' }
	];

	const whereForms = [
		["{ status: 'published' }", 'status == "published"'],
		["{ status: { eq: 'published' } }", 'status == "published"'],
		["{ status: { not: 'draft' } }", 'status != "draft"'],
		["{ status: { in: ['draft', 'published'] } }", '(status == "draft" || status == "published")'],
		["{ status: { notIn: ['draft'] } }", 'status != "draft"'],
		['{ views: { gt: 10, lte: 100 } }', 'views > 10 && views <= 100'],
		["{ title: { contains: 'svelte' } }", 'contains(title, "svelte")'],
		["{ title: { notContains: 'draft' } }", '!contains(title, "draft")'],
		["{ slug: { startsWith: 'release-' } }", 'starts_with(slug, "release-")'],
		["{ email: { endsWith: '@example.com' } }", 'ends_with(email, "@example.com")'],
		["{ tags: { has: 'news' } }", 'any(tags) == "news"'],
		['{ tags: { isEmpty: true } }', 'tags == ""'],
		['{ cover: null }', 'cover == null'],
		['{ published_at: { lte: new Date() } }', 'published_at <= "2026-10-25T09:30:00.000Z"'],
		['{ $or: [{ featured: true }, { views: { gt: 500 } }] }', '(featured == true || views > 500)'],
		['{ $and: [ … ] }', '( … && … )']
	];

	const comparisons = [
		['Every field', 'A value (equals), null, eq, not, in, notIn'],
		['Numbers', 'Also gt, gte, lt, lte'],
		[
			'Text, and Date fields',
			'Also gt, gte, lt, lte (a Date for dates), contains, notContains, startsWith, endsWith'
		],
		['Booleans', 'A value, null, eq, not, in, notIn'],
		['Multiple relations, files and lists', 'has (one of the items equals the value), isEmpty']
	];
</script>

<DocsPage
	title="Filters"
	description="Pick records with a typed where object in findMany, count and subscribe, or write a condition by hand with the condition tag."
	{sections}
>
	<h2 id="where">The where object</h2>

	<p>
		<Code.Root>where</Code.Root> is typed by the fields of the collection: a value means "equals", an
		object holds comparisons, and fields next to each other must all match.
		<Code.Root>$or</Code.Root> and <Code.Root>$and</Code.Root> take a list of such objects. Values are
		escaped, so they can come from users. It works in every list call and in
		<a href={resolve('/docs/sdk/realtime')}>subscribe()</a>.
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.whereObject} />
	</CodeBlock.Root>

	<h2 id="comparisons">Comparisons per field</h2>

	<DocsTable head={['Field', 'Comparisons']} rows={comparisons} code={0} />

	<p>
		Text search is case-insensitive, and <Code.Root>%</Code.Root> and <Code.Root>_</Code.Root> are plain
		characters; for a pattern, use the
		<a href="{resolve('/docs/platform/collections/filters')}#functions">like()</a> function in a
		<a href="#writing-conditions">hand-written condition</a>. An empty <Code.Root>in</Code.Root> or
		<Code.Root>$or</Code.Root> matches nothing, and <Code.Root>null</Code.Root> matches empty fields.
	</p>

	<h2 id="what-is-sent">What is sent</h2>

	<p>
		The SDK turns the object into a
		<a href={resolve('/docs/platform/collections/filters')}>condition</a>, the syntax of the access
		rules, and sends it as the <Code.Root>where</Code.Root> parameter. The query above becomes:
	</p>

	<CodeBlock.Root title="Condition">
		<CodeBlock.Source code={data.code.whereCompiled} />
	</CodeBlock.Root>

	<DocsTable head={['where', 'Condition']} rows={whereForms} code={2} />

	<h2 id="writing-conditions">Writing conditions by hand</h2>

	<p>
		For what the object can't express, such as the signed-in user (<Code.Root>$user.id</Code.Root>)
		or functions, write the condition with the <Code.Root>condition</Code.Root> tag:
	</p>

	<CodeBlock.Root title="TypeScript">
		<CodeBlock.Source code={data.code.conditionTag} />
	</CodeBlock.Root>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:triangle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Never join strings into a condition</Callout.Title>
			<Callout.Description>
				A user's value pasted into the text can change the condition. Put it in
				<Code.Root>{'${…}'}</Code.Root> of the <Code.Root>condition</Code.Root> tag instead.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<p>
		The full syntax is on <a href={resolve('/docs/platform/collections/filters')}>Filters</a> in the
		platform docs. An invalid condition fails with <Code.Root>invalid</Code.Root>.
	</p>
</DocsPage>
