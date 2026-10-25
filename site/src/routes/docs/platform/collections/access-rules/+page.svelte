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
			'Owner',
			'author == $user.id',
			'The user in a relation field to users; any(editors) == $user.id for a multiple one, id == $user.id in users itself'
		],
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
			'list, view: status == "published" or author == $user.id · create: author == $user.id · update, delete: Owner'
		],
		['Private notes', 'Every action: Owner (author == $user.id)'],
		['Comments', 'list, view: Everyone · create: author == $user.id · update, delete: Owner'],
		[
			'Users',
			'list, view, update: Owner (id == $user.id), with role as a hidden field · delete: Admins only'
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
		Every collection has an access rule (API rule) for each action of the records API:
		<strong>list and search</strong>, <strong>view</strong>, <strong>create</strong>,
		<strong>update</strong> and <strong>delete</strong>. Set them with the <strong>API</strong>
		button of the collection, under <strong>Access rules</strong>, or in the <Code.Root
			>rules</Code.Root
		> of the <a href={resolve('/docs/sdk/schema')}>schema API</a>. The rules apply to every call of
		the SDK and the REST API, to included relations and to
		<a href={resolve('/docs/platform/realtime')}>realtime</a> events, which follow the view rule.
	</p>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:lock" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Private by default</Callout.Title>
			<Callout.Description>
				A new collection has every rule set to Admins only, so nothing is reachable through the API
				until you open it up, one action at a time.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="presets">Presets</h2>

	<p>Each rule is one of these presets, or a condition of your own:</p>

	<DocsTable head={['Rule', 'Condition', 'Who may']} rows={presets} code={0} />

	<p>
		A custom rule is a <a href={resolve('/docs/platform/collections/filters')}>condition</a>, in the
		same syntax as <Code.Root>where</Code.Root>, which can also use the signed-in user (<Code.Root
			>$user</Code.Root
		>) and, in create and update rules, what is sent (<Code.Root>$input</Code.Root>). The editor
		suggests fields as you type and underlines mistakes. A request with an invalid or expired token
		is refused with <Code.Root>unauthorized</Code.Root>, not treated as signed out.
	</p>

	<h2 id="how-rules-apply">How each rule applies</h2>

	<p>A rule is checked against one record at a time, and its fields are those of:</p>

	<DocsTable head={['Action', 'The rule sees', 'When it doesn’t match']} rows={actions} code={0} />

	<p>
		Hidden records look as if they don't exist, so a user can't find out which ids are taken. The
		rules are independent: a view rule doesn't limit what the list rule shows, so give list and view
		the same rule unless you mean otherwise.
	</p>

	<h2 id="checking-what-is-written">Checking what is written</h2>

	<p>
		In a create rule, the fields are those of the new record, so
		<Code.Root>author == $user.id</Code.Root> only lets users create posts with themselves as the author.
		In an update rule they are the stored record, so the same rule only lets authors change their own
		posts, but not what they change it to. That is what <Code.Root>$input</Code.Root> is for: it holds
		the values sent with the request, and <Code.Root>null</Code.Root> for fields that weren't sent.
	</p>

	<CodeBlock.Root title="Update rule">
		<CodeBlock.Source code={data.code.ruleUpdate} />
	</CodeBlock.Root>

	<p>
		This lets authors change their posts, but not give them to someone else: the author may only be
		left out or set to themselves. In the same way,
		<Code.Root>$input.featured == null</Code.Root> keeps a field for admins only.
	</p>

	<h2 id="recipes">Recipes</h2>

	<p>The rules of a blog where users write their own posts, one per action:</p>

	<CodeBlock.Root title="Rules of posts">
		<CodeBlock.Source code={data.code.ruleRecipes} />
	</CodeBlock.Root>

	<p>And common setups, per collection:</p>

	<DocsTable head={['Collection', 'Rules']} rows={setups} code={0} />

	<h2 id="roles">Roles</h2>

	<p>
		In a rule, <Code.Root>$user</Code.Root> has every field of <Code.Root>users</Code.Root>,
		including the ones you add and
		<a href="{resolve('/docs/platform/collections')}#hidden-fields">hidden fields</a>. For roles,
		add a <Code.Root>role</Code.Root> list to users, make it hidden, and use it in rules:
		<Code.Root>$user.role == "editor"</Code.Root>, or
		<Code.Root>author == $user.id or $user.role == "admin"</Code.Root>.
	</p>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:triangle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Don't let users give themselves a role</Callout.Title>
			<Callout.Description>
				With an update rule of <Code.Root>id == $user.id</Code.Root> on users, users can change every
				field of their own record that isn't hidden. A hidden role can only be set by admins, service
				keys and plugins; a role that isn't hidden needs <Code.Root
					>and $input.role == null</Code.Root
				> in the update rule.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="denied-requests">Denied requests</h2>

	<p>
		A request that a rule doesn't allow fails with one of these responses. The
		<a href={resolve('/docs/sdk/errors')}>JS SDK</a> throws them as a
		<Code.Root>PouchbaseError</Code.Root>, except that <Code.Root>find()</Code.Root> returns
		<Code.Root>null</Code.Root> for a hidden record; the
		<a href="{resolve('/docs/api/introduction')}#errors">REST API</a> answers with the status and a
		<Code.Root>message</Code.Root>.
	</p>

	<DocsTable head={['When', 'Status', 'Message']} rows={denied} code={0} />

	<h2 id="bypassing-rules">Bypassing the rules</h2>

	<p>
		The rules don't apply to admins in the dashboard, nor to server-side code with an
		<a href={resolve('/docs/platform/api-keys')}>API key</a> with the <strong>service</strong>
		scope, such as a back-end that writes what users may not. With the JS SDK, that code calls the records
		through
		<a href={resolve('/docs/sdk/api-keys')}><Code.Root>pouch.asService()</Code.Root></a>.
	</p>

	<Callout.Root variant="error">
		<Callout.Icon><Icon.Root icon="lucide:key-round" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Never put a service key in a browser</Callout.Title>
			<Callout.Description>
				Anyone who has the key can read and write every record. Keep it in the environment of your
				server, and use the user's token in code that runs in the browser.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<p>
		<a href={resolve('/docs/plugins/collections')}>Plugins</a> don't follow the rules either: they reach
		the collections they list in their permissions.
	</p>
</DocsPage>
