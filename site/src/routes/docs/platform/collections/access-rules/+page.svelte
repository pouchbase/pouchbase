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
		{ id: 'rules', title: 'A rule per action' },
		{ id: 'presets', title: 'Presets' },
		{ id: 'how-rules-apply', title: 'How each rule applies' },
		{ id: 'checking-what-is-written', title: 'Checking what is written' },
		{ id: 'recipes', title: 'Recipes' },
		{ id: 'roles', title: 'Roles' },
		{ id: 'denied-requests', title: 'Denied requests' },
		{ id: 'bypassing-rules', title: 'Bypassing the rules' }
	];

	const presets = [
		['Admins only', '(none)', 'Nobody through the API; only admins in the dashboard. The default'],
		['Everyone', '(empty)', 'Anyone, also without signing in'],
		['Signed-in users', '$user.id != null', 'Any request with a valid token'],
		[
			'Owner (author)',
			'author == $user.id',
			'The user in a relation to users; any(editors) == $user.id for a multiple one'
		],
		['The user themselves', 'id == $user.id', 'In users: each user only their own record'],
		['Custom rule', 'a condition', 'Only for records that match it']
	];

	const actions = [
		[
			'List/Search',
			'The records to list',
			'Filters the results: other records are left out, and not counted in total'
		],
		['View', 'The record', 'A hidden record is not found: null from find()'],
		[
			'Create',
			'The new record, with its default values',
			'Nothing is saved, and the call fails with forbidden'
		],
		[
			'Update',
			'The record as it is stored, before the change',
			'The record is not found: patch() fails with not_found'
		],
		['Delete', 'The record', 'The record is not found: remove() fails with not_found']
	];

	const setups = [
		[
			'Blog',
			'list, view: status == "published" || author == $user.id · create: author == $user.id · update, delete: Owner (author)'
		],
		['Private notes', 'Every action: Owner (author)'],
		[
			'Comments',
			'list, view: Everyone · create: author == $user.id · update, delete: Owner (author)'
		],
		[
			'Users',
			'list, view, update: The user themselves, with role as a hidden field · delete: Admins only'
		],
		['Read-only catalog', 'list, view: Everyone · create, update, delete: Admins only']
	];

	const denied = [
		['The rule is Admins only', '403', 'Only admins can do this: the API rule is locked'],
		[
			'The create rule doesn’t match the new record',
			'403',
			'The create rule of this collection doesn’t allow this record'
		],
		[
			'The rule can’t run, e.g. a field it uses was deleted',
			'403',
			'The Update rule of this collection is invalid'
		],
		[
			'The API doesn’t offer the action, such as creating users',
			'403',
			'The records API doesn’t offer this for this collection'
		],
		['The view, update or delete rule hides the record', '404', 'Record not found'],
		['The token is invalid or has expired', '401', 'Invalid or expired token']
	];
</script>

<DocsPage
	title="Access rules"
	description="Decide who may list, view, create, update and delete the records of each collection, with a rule per action that can depend on the record, the signed-in user and what is sent."
	{sections}
>
	<h2 id="rules">A rule per action</h2>

	<p>
		Every collection has an access rule (API rule) for <strong>list and search</strong>,
		<strong>view</strong>, <strong>create</strong>, <strong>update</strong> and
		<strong>delete</strong>. Set them under <strong>API → Access rules</strong> of the collection,
		or in the <Code.Root>rules</Code.Root> of the
		<a href={resolve('/docs/sdk/schema')}>schema API</a>. They apply to every call of the SDK and
		the REST API, to included relations and to
		<a href={resolve('/docs/platform/realtime')}>realtime</a> events, which follow the view rule.
	</p>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:lock" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Private by default</Callout.Title>
			<Callout.Description>
				A new collection has every rule set to Admins only, so nothing is reachable through the API
				until you open it up.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="presets">Presets</h2>

	<DocsTable head={['Rule', 'Condition', 'Who may']} rows={presets} code={0} />

	<p>
		A custom rule is a <a href={resolve('/docs/platform/collections/filters')}>condition</a> in the
		syntax of <Code.Root>where</Code.Root>, which can also use the signed-in user (<Code.Root
			>$user</Code.Root
		>) and, in create and update rules, what is sent (<Code.Root>$input</Code.Root>). The editor
		suggests fields and underlines mistakes.
	</p>

	<h2 id="how-rules-apply">How each rule applies</h2>

	<p>A rule is checked against one record at a time, and its fields are those of:</p>

	<DocsTable head={['Action', 'The rule sees', 'When it doesn’t match']} rows={actions} code={0} />

	<p>
		Records a rule hides look as if they don't exist, so users can't find out which ids are taken.
		The rules are independent: a view rule doesn't limit the list rule, so give both the same rule
		unless you mean otherwise.
	</p>

	<h2 id="checking-what-is-written">Checking what is written</h2>

	<p>
		In a create rule, <Code.Root>author == $user.id</Code.Root> checks the new record, so users can only
		create posts as themselves. In an update rule it checks the stored record, so it limits whose posts
		change, not what they change to. For that, <Code.Root>$input</Code.Root> holds the values sent, and
		<Code.Root>null</Code.Root> for fields that weren't sent:
	</p>

	<CodeBlock.Root title="Update rule">
		<CodeBlock.Source code={data.code.ruleUpdate} />
	</CodeBlock.Root>

	<p>
		Authors can change their posts but not give them away. In the same way,
		<Code.Root>$input.featured == null</Code.Root> keeps a field for admins only.
	</p>

	<h2 id="recipes">Recipes</h2>

	<p>A blog where users write their own posts:</p>

	<CodeBlock.Root title="Rules of posts">
		<CodeBlock.Source code={data.code.ruleRecipes} />
	</CodeBlock.Root>

	<p>Common setups:</p>

	<DocsTable head={['Collection', 'Rules']} rows={setups} code={0} />

	<h2 id="roles">Roles</h2>

	<p>
		In a rule, <Code.Root>$user</Code.Root> has every field of <Code.Root>users</Code.Root>,
		including
		<a href="{resolve('/docs/platform/collections')}#hidden-fields">hidden fields</a>. For roles,
		add a hidden <Code.Root>role</Code.Root> list to users and use it in rules:
		<Code.Root>$user.role == "editor"</Code.Root>, or
		<Code.Root>author == $user.id || $user.role == "admin"</Code.Root>.
	</p>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:triangle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Don't let users give themselves a role</Callout.Title>
			<Callout.Description>
				With an update rule of <Code.Root>id == $user.id</Code.Root> on users, users can change every
				field of their own record that isn't hidden. Make the role hidden, or add
				<Code.Root>&amp;&amp; $input.role == null</Code.Root> to the update rule.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="denied-requests">Denied requests</h2>

	<p>
		The <a href={resolve('/docs/sdk/errors')}>JS SDK</a> throws these as a
		<Code.Root>PouchbaseError</Code.Root> (except <Code.Root>find()</Code.Root>, which returns
		<Code.Root>null</Code.Root>); the
		<a href="{resolve('/docs/api/introduction')}#errors">REST API</a> answers with the status and a
		<Code.Root>message</Code.Root>.
	</p>

	<DocsTable head={['When', 'Status', 'Message']} rows={denied} code={0} />

	<h2 id="bypassing-rules">Bypassing the rules</h2>

	<p>
		The rules don't apply to admins in the dashboard, nor to server-side code with an
		<a href={resolve('/docs/platform/api-keys')}>API key</a> (in the JS SDK, a client with an
		<a href="{resolve('/docs/sdk/api-keys')}#admin-access"><Code.Root>apiKey</Code.Root></a>). Keep
		keys out of the browser: anyone with one can read and write every record.
		<a href={resolve('/docs/plugins/collections')}>Plugins</a> skip the rules too, for their own collections
		and those in their permissions.
	</p>
</DocsPage>
