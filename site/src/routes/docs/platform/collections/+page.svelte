<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as LinkCard from '#lib/components/ui/link-card/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';
	import DocsTable from '../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'collections', title: 'Collections' },
		{ id: 'field-types', title: 'Field types' },
		{ id: 'hidden-fields', title: 'Hidden fields' },
		{ id: 'a-record', title: 'A record' },
		{ id: 'built-in-collections', title: 'Built-in collections' },
		{ id: 'types', title: 'TypeScript types' },
		{ id: 'next-steps', title: 'Next steps' }
	];

	const fieldTypes = [
		['ID', 'The key of each record, generated when it is created', '"k3j9x2m1q8w7e5r"'],
		['Created', 'The time the record was created', '1792661400000 (milliseconds)'],
		['Updated', 'The time the record was last saved', '1792747800000 (milliseconds)'],
		['Text', 'Plain text', '"Hello"'],
		['Rich text', 'Formatted text from the editor, as HTML or Markdown', '"<p>Hello</p>"'],
		['Number', 'A decimal number', '3.14'],
		['Integer', 'A whole number', '42'],
		['Boolean', 'True or false', 'true'],
		['Date', 'A date and time', '"2026-10-20T09:30:00.000Z"'],
		['Email', 'An email address', '"ada@example.com"'],
		['URL', 'A web address', '"https://example.com"'],
		['JSON', 'Any JSON value, parsed', '{ "theme": "dark" }'],
		['List', 'One item, or several, from a fixed list', '"draft", or ["news", "release"]'],
		[
			'Relation',
			'Links to one record of another collection, or several',
			'"u7d2k9q4m1x8z3p", or an array of ids'
		],
		['File', 'An upload in the files collection, or several', '"f9w2e4r6t8y1u3i", or an array'],
		['Computed', 'Calculated from another field on save, e.g. a slug', '"hello-pouchbase"'],
		['Blob', 'Binary data; only in the dashboard', 'Left out of the API']
	];

	const examplePosts = [
		['id', 'ID', 'A random string'],
		['title', 'Text', 'Required'],
		['slug', 'Computed', 'From title, unique'],
		['body', 'Rich text', ''],
		['status', 'List', 'draft or published, default draft'],
		['tags', 'List', 'Multiple: news, release, guide'],
		['views', 'Integer', 'Default 0'],
		['featured', 'Boolean', ''],
		['author', 'Relation', 'To users'],
		['cover', 'File', 'Images only'],
		['published_at', 'Date', ''],
		['created_at', 'Created', ''],
		['updated_at', 'Updated', '']
	];

	const hiddenRules = [
		['App users', 'No', 'Not in records, includes, realtime events or /api/auth/me'],
		['Their filters, order, select and include', 'No', 'As if the field doesn’t exist'],
		['Writes by app users', 'No', 'A create or update that sends it fails'],
		['API rules', 'Yes', 'The rule can use the field, and $user.<field> for users'],
		['Admins, service keys, plugins', 'Yes', 'They read and write it like any field'],
		['Functions (pouchbaseUser)', 'Yes', 'The signed-in user with every field, on the server']
	];

	const topics = [
		{
			title: 'Access rules',
			href: resolve('/docs/platform/collections/access-rules'),
			icon: 'lucide:shield-check',
			description: 'Who may list, view, create, update and delete, with rules for common cases.'
		},
		{
			title: 'Filters',
			href: resolve('/docs/platform/collections/filters'),
			icon: 'lucide:list-filter',
			description: 'The condition syntax of access rules, filters and realtime subscriptions.'
		},
		{
			title: 'Files',
			href: resolve('/docs/platform/collections/files'),
			icon: 'lucide:paperclip',
			description: 'Uploads in the files collection, their URLs and thumbnails.'
		},
		{
			title: 'Export and import',
			href: resolve('/docs/platform/collections/schema'),
			icon: 'lucide:database',
			description: 'Copy collections with their fields and rules to another instance.'
		},
		{
			title: 'Records in the JS SDK',
			href: resolve('/docs/sdk/records'),
			icon: 'lucide:braces',
			description: 'Read, page through, create, change and delete records from TypeScript.'
		},
		{
			title: 'Records in the REST API',
			href: resolve('/docs/api/records'),
			icon: 'lucide:terminal',
			description: 'The same from any language, with cURL examples and every status code.'
		}
	];
</script>

<DocsPage
	title="Collections"
	description="Model your data in collections of typed fields, then read and write their records from your app through the SDK or the REST API."
	{sections}
>
	<h2 id="collections">Collections</h2>

	<p>
		A collection is a table in the app database of your instance, and each of its rows is a <strong
			>record</strong
		>. You create collections and their fields in the dashboard, under <strong>Collections</strong>,
		or <a href={resolve('/docs/sdk/schema')}>from code</a>. Every collection has an
		<a href={resolve('/docs/platform/collections/access-rules')}>access rule</a> per action, which decides
		who may read and write its records through the API; new collections are only open to admins.
	</p>

	<p>
		The examples in these docs use a <Code.Root>posts</Code.Root> collection like this one, and a
		<Code.Root>comments</Code.Root> collection with a <Code.Root>post</Code.Root> relation to posts, an
		<Code.Root>author</Code.Root> relation to users, a <Code.Root>body</Code.Root> and a
		<Code.Root>created_at</Code.Root>:
	</p>

	<DocsTable head={['Field', 'Type', 'Settings']} rows={examplePosts} />

	<h2 id="field-types">Field types</h2>

	<p>
		Each field has a type, which sets what it holds, how it is checked when a record is saved and
		what the API returns for it:
	</p>

	<DocsTable head={['Type', 'Holds', 'The API returns']} rows={fieldTypes} code={0} />

	<p>
		An empty field is <Code.Root>null</Code.Root>, and an empty multiple field (relations, files or
		lists with <strong>Multiple</strong> on) is <Code.Root>[]</Code.Root>. A field can be
		<strong>required</strong>, <strong>unique</strong> and have a <strong>default value</strong>,
		which a new record gets when the field is left out. Collections get an ID field and timestamps
		only when you add them; without an ID field, other records can't link to them.
		<a href={resolve('/docs/plugins/field-types')}>Plugins</a> can add field types of their own.
	</p>

	<h2 id="hidden-fields">Hidden fields</h2>

	<p>
		A field can also be <strong>hidden</strong>: then it is for your own code only. Use it for what
		the users of your app must not see or change, such as a <Code.Root>role</Code.Root>, a
		<Code.Root>stripe_customer_id</Code.Root> or internal notes. Tick <strong>Hidden</strong> when
		you add the field, or in the <strong>Hidden</strong> column when you edit the fields of a
		collection. The ID field and the built-in fields of <Code.Root>users</Code.Root> and
		<Code.Root>files</Code.Root> can't be hidden.
	</p>

	<DocsTable head={['Who', 'Sees it', 'How']} rows={hiddenRules} code={0} />

	<p>
		So an <a href={resolve('/docs/platform/collections/access-rules')}>access rule</a> such as
		<Code.Root>$user.role == "editor"</Code.Root> works while users can't read or set their role, and
		a back-end with a <a href={resolve('/docs/platform/api-keys')}>service key</a> sets it.
	</p>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:triangle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Give required hidden fields a default</Callout.Title>
			<Callout.Description>
				App users can't send a hidden field, so a required one needs a default value; otherwise
				their creates fail. A unique hidden field still refuses a value another record has, which
				tells the user that the value exists.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="a-record">A record</h2>

	<p>A record of <Code.Root>posts</Code.Root>, as every read and write of the API returns it:</p>

	<CodeBlock.Root title="Response">
		<CodeBlock.Source code={data.code.record} />
	</CodeBlock.Root>

	<p>
		Values come back as real JSON values: booleans as booleans, JSON fields parsed and multiple
		fields as arrays. Relation and file fields hold ids; <a
			href="{resolve('/docs/sdk/records')}#relations">include</a
		> returns the related records instead.
	</p>

	<h2 id="built-in-collections">Built-in collections</h2>

	<p>
		Every installation has two collections of its own. You can add fields to them, but not rename or
		delete them, and the API offers fewer actions for them:
	</p>

	<ul>
		<li>
			<Code.Root>users</Code.Root>: the users of your app, with an email, name, avatar and verified
			field. Users are created by signing up (see
			<a href={resolve('/docs/platform/authentication')}>Authentication</a>), so the API can list,
			view, update and delete them, but not create them. <Code.Root>email</Code.Root> and
			<Code.Root>verified</Code.Root> can't be changed through it.
		</li>
		<li>
			<Code.Root>files</Code.Root>: uploads, which the API can list, view and delete (see
			<a href={resolve('/docs/platform/collections/files')}>Files</a>).
		</li>
	</ul>

	<h2 id="types">TypeScript types</h2>

	<p>
		The <strong>Types</strong> page of the dashboard has TypeScript types for your collections, and
		a URL to download them, for example in a <Code.Root>postinstall</Code.Root> script or a CI job. With
		them, the <a href={resolve('/docs/sdk/types')}>JS SDK</a> checks field names, filters and the values
		you send. The URL holds a token of its own: anyone with it can read the names and fields of your collections,
		but no records.
	</p>

	<h2 id="next-steps">Next steps</h2>

	<div class="not-prose grid gap-3 sm:grid-cols-2">
		{#each topics as topic (topic.href)}
			<LinkCard.Root href={topic.href}>
				<LinkCard.Icon><Icon.Root icon={topic.icon} /></LinkCard.Icon>

				<LinkCard.Body>
					<LinkCard.Title>
						{topic.title}
						<Icon.Root icon="lucide:arrow-right" />
					</LinkCard.Title>
					<LinkCard.Description>{topic.description}</LinkCard.Description>
				</LinkCard.Body>
			</LinkCard.Root>
		{/each}
	</div>
</DocsPage>
