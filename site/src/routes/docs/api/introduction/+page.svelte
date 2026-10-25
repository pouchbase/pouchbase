<script lang="ts">
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
		{ id: 'requests', title: 'Requests' },
		{ id: 'authorization', title: 'Authorization' },
		{ id: 'errors', title: 'Errors' },
		{ id: 'status-codes', title: 'Status codes' },
		{ id: 'health', title: 'Health check' },
		{ id: 'endpoints', title: 'Endpoints' }
	];

	const authorization = [
		[
			'(none)',
			'Signed out',
			'The records the access rules open to everyone, signing in, files and functions'
		],
		[
			'Bearer <token>',
			'A signed-in app user',
			'The same, plus what the access rules allow that user, and /api/auth/me'
		],
		[
			'Bearer pbk_… (standard)',
			'Server-side code, such as a function',
			'Sending email; not the records or schema API (403)'
		],
		[
			'Bearer pbk_… (service)',
			'Server-side code that acts as an admin',
			'Sending email, the records API without access rules, and the schema API'
		],
		[
			'Bearer pbk_… (plugin)',
			'The Worker of an installed plugin',
			'Only the records API of the collections the plugin may use'
		]
	];

	const statuses = [
		['200', 'OK'],
		['201', 'Created: a new collection'],
		['202', 'Accepted: an OAuth sign-in is still pending'],
		['204', 'No content: deleted'],
		['400', 'The body or a parameter isn’t valid; issues has a message per field'],
		['401', 'The token or API key is missing, invalid or expired'],
		['403', 'Not allowed: a locked access rule, or a key of the wrong scope'],
		['404', 'Not found, or hidden by an access rule'],
		['409', 'A conflict: a unique value is taken, or a change would remove data'],
		['422', 'Valid JSON that can’t be used, such as a template without its variables'],
		['426', 'A plain request to the realtime endpoint, which needs a WebSocket'],
		['500', 'Something went wrong on the server'],
		['502', 'A function or the mail provider couldn’t be reached'],
		['503', 'Sending email isn’t set up']
	];

	const pages = [
		{
			title: 'Authentication',
			href: resolve('/docs/api/authentication'),
			icon: 'lucide:key-round',
			description: '/api/auth/*: sign up, sign in, OAuth, verification and password reset.'
		},
		{
			title: 'Records',
			href: resolve('/docs/api/records'),
			icon: 'lucide:rows-3',
			description: '/api/db/<collection>: list, get, create, update and delete records.'
		},
		{
			title: 'Realtime',
			href: resolve('/docs/api/realtime'),
			icon: 'lucide:radio',
			description: '/api/realtime: changes to records as they are saved, over a WebSocket.'
		},
		{
			title: 'Files',
			href: resolve('/docs/api/files'),
			icon: 'lucide:paperclip',
			description: '/api/files/<id>: uploaded files and their thumbnails.'
		},
		{
			title: 'Functions',
			href: resolve('/docs/api/functions'),
			icon: 'lucide:square-function',
			description: '/api/functions/<name>: call your own server-side code.'
		},
		{
			title: 'Email',
			href: resolve('/docs/api/mail'),
			icon: 'lucide:mail',
			description: '/api/mail/send: send an email template, with an API key.'
		},
		{
			title: 'Schema and types',
			href: resolve('/docs/api/schema'),
			icon: 'lucide:database',
			description: '/api/schema and /api/types: manage collections and download their types.'
		}
	];
</script>

<DocsPage
	title="REST API"
	description="Every part of Pouchbase your app uses is an HTTP endpoint under /api, which you can call from any language or client."
	{sections}
>
	<p>
		These pages describe the HTTP API itself, for other languages and clients. In TypeScript and
		JavaScript, the <a href={resolve('/docs/sdk/getting-started')}>JS SDK</a> calls it for you, with types
		for your collections.
	</p>

	<h2 id="requests">Requests</h2>

	<p>
		Every endpoint is under <Code.Root>/api</Code.Root> on the URL of your instance, such as
		<Code.Root>https://pouchbase.example.com/api/db/posts</Code.Root>. Request bodies are JSON, sent
		with <Code.Root>Content-Type: application/json</Code.Root>, and so is every answer, except
		files, the TypeScript types and what a function returns.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.request} />
	</CodeBlock.Root>

	<p>
		The API answers requests from any origin, so a web app on another domain can call it straight
		from the browser. It never uses cookies: who a request is for always comes from its
		<Code.Root>Authorization</Code.Root> header, so another site can't act for your users.
	</p>

	<h2 id="authorization">Authorization</h2>

	<p>
		Send who the request is for as <Code.Root>Authorization: Bearer …</Code.Root>: the token of a
		signed-in user (see <a href={resolve('/docs/api/authentication')}>Authentication</a>), an API
		key, or nothing:
	</p>

	<DocsTable head={['Authorization', 'For', 'May call']} rows={authorization} />

	<p>
		Admins create API keys under <strong>System → API keys</strong> in the dashboard; see
		<a href={resolve('/docs/platform/api-keys')}>API keys</a>. Keep them on a server: never put a
		key in an app that runs in the browser.
	</p>

	<h2 id="errors">Errors</h2>

	<p>
		Every error has a <Code.Root>message</Code.Root>, in English, for people. Validation errors also
		have <Code.Root>issues</Code.Root>, with a message per field, and some errors a
		<Code.Root>code</Code.Root> to check in code, such as <Code.Root>email_not_verified</Code.Root>.
	</p>

	<CodeBlock.Root title="400 Bad Request">
		<CodeBlock.Source code={data.code.error} />
	</CodeBlock.Root>

	<h2 id="status-codes">Status codes</h2>

	<DocsTable head={['Status', 'Means']} rows={statuses} />

	<h2 id="health">Health check</h2>

	<p>
		<Code.Root>GET /api/health</Code.Root> answers <Code.Root>{'{ "status": "ok" }'}</Code.Root>
		when the server is up, for Docker and load balancers. It answers before the installation is finished
		too, so it doesn't check that the databases can be reached.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.health} />
	</CodeBlock.Root>

	<h2 id="endpoints">Endpoints</h2>

	<div class="not-prose grid gap-3 sm:grid-cols-2">
		{#each pages as entry (entry.href)}
			<LinkCard.Root href={entry.href}>
				<LinkCard.Icon><Icon.Root icon={entry.icon} /></LinkCard.Icon>

				<LinkCard.Body>
					<LinkCard.Title>
						{entry.title}
						<Icon.Root icon="lucide:arrow-right" />
					</LinkCard.Title>
					<LinkCard.Description>{entry.description}</LinkCard.Description>
				</LinkCard.Body>
			</LinkCard.Root>
		{/each}
	</div>
</DocsPage>
