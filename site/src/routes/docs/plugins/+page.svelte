<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		// Quick start
		{ id: 'what-plugins-add', title: 'What plugins add' },
		{ id: 'create-a-plugin', title: 'Create a plugin' },
		{ id: 'test-locally', title: 'Test locally' },
		{ id: 'install', title: 'Install a plugin' },
		// Concepts
		{ id: 'project-layout', title: 'Project layout' },
		{ id: 'the-manifest', title: 'The manifest' },
		{ id: 'field-types', title: 'Field types' },
		{ id: 'pages', title: 'Pages' },
		{ id: 'routes', title: 'Routes' },
		{ id: 'sign-in-providers', title: 'Sign-in providers' },
		{ id: 'settings', title: 'Settings' },
		{ id: 'icons', title: 'Icons' },
		{ id: 'ui-components', title: 'UI components' },
		{ id: 'server-code', title: 'Server code' },
		// Testing and debugging
		{ id: 'testing', title: 'Testing' },
		{ id: 'debugging', title: 'Debugging' },
		// Publishing
		{ id: 'publish', title: 'Publish' },
		// Reference
		{ id: 'the-cli', title: 'The CLI' },
		{ id: 'limits', title: 'Limits' },
		{ id: 'security', title: 'Security model' },
		{ id: 'versions-and-compatibility', title: 'Compatibility and updates' },
		{ id: 'registries', title: 'Registries' }
	];

	const files = [
		{
			file: 'fields/<type>/field.ts',
			adds: 'The field type <type>, stored as <plugin>:<type>. Needs an input.svelte next to it.'
		},
		{
			file: 'fields/<type>/icon.svg',
			adds: 'The field type’s icon, when defineField names none. See Icons.'
		},
		{
			file: 'pages/<path>.svelte',
			adds: 'A dashboard page at /plugins/<plugin>/<path>; pages/<path>/index.svelte is the same page.'
		},
		{
			file: 'pages/<path>.svg',
			adds: 'The page’s icon in the sidebar (stats.svg for stats.svelte), when its meta names none.'
		},
		{
			file: 'auth/<id>/provider.ts',
			adds: 'The sign-in provider <id>; an icon.svg next to it is its logo.'
		},
		{
			file: 'routes/<path>.ts',
			adds: 'Routes at /api/plugins/<plugin>/<path>, one export per HTTP method.'
		},
		{
			file: 'plugin.ts',
			adds: 'The plugin’s settings: default-exports definePlugin({ settings }). See Settings.'
		},
		{
			file: 'icon.svg',
			adds: 'The plugin’s icon in the marketplace and the dashboard; square, shown at 40 pixels and smaller.'
		},
		{
			file: 'lib/ (or any other file)',
			adds: 'Shared code, imported by the files above; never a contribution itself.'
		}
	];

	const context = [
		{ member: 'ctx.plugin', about: 'The plugin’s id and version.' },
		{
			member: 'ctx.settings.get(key)',
			about:
				'A promise of a setting from plugin.ts, parsed by its type: the value an admin saved, else its default, else null. ctx.settings.getAll() gives them all.'
		},
		{
			member: 'ctx.fetch',
			about: 'fetch, limited to the HTTPS hosts in permissions.network.'
		},
		{
			member: 'ctx.log',
			about:
				'info, warn and error, written to the console of the plugin’s Worker (for a built-in plugin, the Pouchbase log). See Debugging.'
		},
		{
			member: 'ctx.admin',
			about:
				'true only for a route request from an admin signed in to the dashboard; false everywhere else.'
		},
		{
			member: 'ctx.user',
			about:
				'In a route: the app user of the request’s bearer token (id, email, name, verified, avatar and the other fields of users; never passwords or tokens), or null.'
		},
		{
			member: 'ctx.params',
			about:
				'In a route: the [name] segments of its file, e.g. { id: "42" } for routes/items/[id].ts.'
		}
	];

	const settingKeys = [
		{
			key: 'key',
			about:
				"How the code reads it: ctx.settings.get('api_key'). Lowercase letters, numbers and underscores; unique."
		},
		{ key: 'label', about: 'Its name in the settings form.' },
		{ key: 'description', about: 'One sentence under the field (optional).' },
		{
			key: 'type',
			about:
				'text (default), secret (never shown again once saved), number, boolean or url (an absolute URL).'
		},
		{
			key: 'required',
			about:
				'The plugin can’t work without it: the dashboard marks the plugin “Needs settings” until an admin saves it. Default false.'
		},
		{
			key: 'default',
			about: 'Used while nothing is saved; of the setting’s type. A secret has no default.'
		}
	];

	// HOST_MODULE_IDS of @pouchbasejs/plugin-sdk/ui, without svelte/internal/*, which only the
	// compiled components import.
	const hostModules = [
		{
			group: 'Svelte',
			modules: [
				'svelte',
				'svelte/store',
				'svelte/transition',
				'svelte/animate',
				'svelte/easing',
				'svelte/motion',
				'svelte/reactivity',
				'svelte/events',
				'svelte/attachments'
			]
		},
		{ group: 'Plugin SDK', modules: ['@pouchbasejs/plugin-sdk/ui'] },
		{
			group: 'Dashboard components',
			modules: [
				'@pouchbasejs/ui',
				'@pouchbasejs/ui/badge',
				'@pouchbasejs/ui/button',
				'@pouchbasejs/ui/callout',
				'@pouchbasejs/ui/card',
				'@pouchbasejs/ui/empty',
				'@pouchbasejs/ui/icon',
				'@pouchbasejs/ui/link',
				'@pouchbasejs/ui/meter',
				'@pouchbasejs/ui/progress',
				'@pouchbasejs/ui/scroll-area',
				'@pouchbasejs/ui/segmented',
				'@pouchbasejs/ui/skeleton',
				'@pouchbasejs/ui/spinner',
				'@pouchbasejs/ui/swatch',
				'@pouchbasejs/ui/table',
				'@pouchbasejs/ui/thumbnail',
				'@pouchbasejs/ui/tile',
				'@pouchbasejs/ui/tooltip',
				'@pouchbasejs/ui/inputs/checkbox',
				'@pouchbasejs/ui/inputs/input',
				'@pouchbasejs/ui/inputs/select',
				'@pouchbasejs/ui/inputs/slider',
				'@pouchbasejs/ui/inputs/textarea'
			]
		}
	];

	const routeStatuses = [
		{
			status: '401',
			about:
				'{"message":"Invalid or expired token"}: the request’s bearer token isn’t a valid app user token. Pouchbase answers before the plugin runs; send no token for an anonymous request.'
		},
		{
			status: '404',
			about:
				'{"message":"Route not found"}: no file in routes/ answers the path. {"message":"Plugin not found"}: the plugin isn’t installed, or the id is wrong.'
		},
		{
			status: '405',
			about:
				'{"message":"Method not allowed"}: the path exists, but its file doesn’t export this method; the Allow header lists the ones it does. HEAD requests get this too.'
		},
		{
			status: '422',
			about:
				'Never from Pouchbase for a route: it is a response of the plugin itself. (The registry answers 422 to a bundle it refuses.)'
		},
		{
			status: '500',
			about:
				'{"message":"Could not load the plugin"}: Pouchbase couldn’t load the installed plugin; the reason is in the Pouchbase log.'
		},
		{
			status: '502',
			about:
				'{"message":"The plugin route failed"}: the handler threw, didn’t return a Response, its Worker couldn’t be reached or it didn’t start answering within 10 seconds. The reason is only in the Pouchbase log.'
		}
	];

	const installErrors = [
		{
			message: 'The Cloudflare account has no workers.dev subdomain yet. …',
			about:
				'Error 19011. Open Workers & Pages in the Cloudflare dashboard once to choose a subdomain, then install again.'
		},
		{
			message: 'The plugin’s Worker could not be deployed: <reason>',
			about:
				'The Cloudflare API refused the Worker, e.g. a token without permission to edit Workers or the account’s Worker limit.'
		},
		{
			message: 'The plugin’s UI components could not be compiled',
			about:
				'A component doesn’t compile with the dashboard’s Svelte; admins see each problem as file:line:column: message. validate checks the same.'
		},
		{
			message: 'The plugin’s bundle is not valid: <path>: <message>',
			about: 'The bundle breaks a rule of the manifest or the bundle format.'
		},
		{
			message: 'The plugin’s server code did not answer as expected: <reason>',
			about: 'The deployed server code failed when Pouchbase asked what it contributes.'
		},
		{
			message: 'The sign-in provider <id> already comes from the plugin <plugin>',
			about: 'Provider ids are global; another installed plugin already has this one.'
		},
		{
			message: 'This plugin has no version that this Pouchbase can install',
			about:
				'No published version has an API version and engines.pouchbase range this Pouchbase satisfies.'
		}
	];

	const limits = [
		{ limit: 'Bundle', value: '1 MiB: the manifest, server code and UI files together.' },
		{
			limit: 'Calls',
			value:
				'10 seconds for a field hook, a profile call or until a route’s response starts; then the call fails (502 for a route).'
		},
		{ limit: 'Field types', value: '20 per plugin.' },
		{ limit: 'Pages', value: '20 per plugin.' },
		{ limit: 'Sign-in providers', value: '10 per plugin.' },
		{ limit: 'Settings', value: '30 per plugin; keys of at most 63 characters.' },
		{
			limit: 'Plugin id',
			value: 'At most 64 characters: lowercase words separated by dashes.'
		},
		{
			limit: 'Field type name',
			value: 'At most 32 characters: a lowercase letter, then letters, numbers and underscores.'
		},
		{ limit: 'Icons', value: 'At most 32 KiB each, plain SVG.' },
		{
			limit: 'permissions.network',
			value:
				'At most 20 host names, such as api.example.com or *.example.com: no schemes, ports, paths, IP addresses or localhost. Only HTTPS on the default port.'
		},
		{ limit: 'Categories', value: 'At most 3.' }
	];

	const commands = [
		{
			command: 'init <dir> [--template <name>]',
			about: 'Create a plugin from a template; the directory name becomes its id.'
		},
		{
			command: 'add <field|page|auth-provider|route> <id>',
			about: 'Create the files of a contribution, never overwriting one.'
		},
		{
			command: 'add setting <key> [--type <type>]',
			about:
				'Append a setting to plugin.ts, creating it with the Register block when missing; --type is text (default), secret, number, boolean or url.'
		},
		{
			command: 'validate',
			about:
				'Check the folders, the manifest, the settings, the server code and the UI files, and compile the components the way Pouchbase does.'
		},
		{
			command: 'manifest',
			about: 'Print the full manifest the plugin builds into, as JSON on stdout.'
		},
		{ command: 'build', about: 'Write the bundle to dist/.' },
		{
			command: 'dev [--port 4510] [--exact-version]',
			about: 'Rebuild on every change and serve the plugin from a local registry.'
		},
		{
			command: 'publish [--registry <url>] [--token <token>]',
			about: 'Build the plugin and publish it to the registry.'
		},
		{ command: 'schema', about: 'Print the JSON Schema of the manifest.' }
	];
</script>

<DocsPage
	title="Plugins"
	description="Add field types, dashboard pages, sign-in providers, API routes and settings to Pouchbase, and publish them to the plugin registry so any installation can install them without a rebuild."
	{sections}
>
	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:info" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Plugin API version 1</Callout.Title>
			<Callout.Description>
				Pouchbase installs plugins from the registry and runs everything they contribute. The
				built-in Google, GitHub, Microsoft, Discord and Twitch sign-in are plugins too, written with
				the same SDK.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<p>
		This page starts with a quick start (create a plugin, run it, install it), explains each part of
		a plugin, then covers testing, debugging and publishing, and ends with a reference: the CLI,
		limits, the security model and compatibility.
	</p>

	<h2 id="what-plugins-add">What plugins add</h2>

	<ul>
		<li>
			<strong>Field types</strong> for collections, with an input in the record form, a preview in the
			records grid and validation on the server.
		</li>
		<li>
			<strong>Dashboard pages</strong>, linked in the sidebar under <strong>Plugins</strong>.
		</li>
		<li>
			<strong>Sign-in providers</strong> for your app's users, next to the built-in ones.
		</li>
		<li>
			<strong>Routes</strong> under <Code.Root>/api/plugins/&lt;id&gt;/</Code.Root>, for pages, apps
			and webhooks.
		</li>
		<li>
			<strong>Settings</strong> an admin fills in on the Plugins page, such as an API key.
		</li>
	</ul>

	<p>
		The <a href="https://github.com/pouchbase/pouchbase/tree/main/examples/plugin-demo"
			>demo plugin</a
		>
		uses all of it except sign-in providers, with tests; the samples on this page marked as coming from
		it are its current code.
	</p>

	<h2 id="create-a-plugin">Create a plugin</h2>

	<p>
		Plugins are built with <a href="https://www.npmjs.com/package/@pouchbasejs/plugin-sdk"
			><Code.Root>@pouchbasejs/plugin-sdk</Code.Root></a
		>, which has the types, the manifest schema and the <Code.Root>pouchbase-plugin</Code.Root> CLI. Start
		a new plugin with <Code.Root>init</Code.Root>; the directory name becomes the plugin's id:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.init} />
	</CodeBlock.Root>

	<p>
		In a terminal, <Code.Root>init</Code.Root> asks which template to start from; pass
		<Code.Root>--template</Code.Root> to choose it up front (without a terminal it uses
		<Code.Root>field</Code.Root>):
	</p>

	<ul>
		<li>
			<Code.Root>field</Code.Root>: a color field type with an input, a preview and validation on
			the server, in <Code.Root>fields/color/</Code.Root>.
		</li>
		<li>
			<Code.Root>page</Code.Root>: a dashboard page, <Code.Root>pages/hello.svelte</Code.Root>, that
			calls the plugin's <Code.Root>GET /hello</Code.Root> route in <Code.Root
				>routes/hello.ts</Code.Root
			>.
		</li>
		<li>
			<Code.Root>auth-provider</Code.Root>: a sign-in provider built with
			<Code.Root>createOidcProvider</Code.Root>; a plugin named <Code.Root>auth-gitlab</Code.Root> gets
			<Code.Root>auth/gitlab/</Code.Root>, and an example host in <Code.Root
				>permissions.network</Code.Root
			>.
		</li>
		<li><Code.Root>empty</Code.Root>: only the manifest and an icon.</li>
	</ul>

	<p>
		Every template sets <Code.Root>engines.pouchbase</Code.Root> to <Code.Root
			>&gt;=0.10.0</Code.Root
		>
		and comes with a test and the scripts <Code.Root>dev</Code.Root>, <Code.Root>check</Code.Root>,
		<Code.Root>test</Code.Root>, <Code.Root>validate</Code.Root>, <Code.Root>build</Code.Root> and
		<Code.Root>release</Code.Root>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.templates} />
	</CodeBlock.Root>

	<p>
		Add more to a plugin later with <Code.Root>add</Code.Root>, which creates the files of a
		contribution and never overwrites one. The files are the contribution, so it only touches
		<Code.Root>pouchbase-plugin.json</Code.Root> to add a category to an explicit
		<Code.Root>categories</Code.Root> list, or the example host of a new sign-in provider to
		<Code.Root>permissions.network</Code.Root>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.add} />
	</CodeBlock.Root>

	<h2 id="test-locally">Test locally</h2>

	<p>
		<Code.Root>pnpm dev</Code.Root> (<Code.Root>pouchbase-plugin dev</Code.Root>) rebuilds the
		plugin on every change and serves it from a local registry on
		<Code.Root>http://localhost:4510</Code.Root> (<Code.Root>--port</Code.Root> to change it). Point a
		Pouchbase on the same machine at it with the
		<a href={resolve('/docs/getting-started')}>server variable</a>
		<Code.Root>POUCHBASE_REGISTRY_URL</Code.Root>, then install the plugin from the
		<strong>Plugins</strong> page of the dashboard:
	</p>

	<CodeBlock.Root title=".env">
		<CodeBlock.Source code={data.code.devRegistry} />
	</CodeBlock.Root>

	<p>That Pouchbase can be either of these; you don't need the Pouchbase repository:</p>

	<ul>
		<li>
			<strong>A normal installation</strong> running on your machine, such as the
			<a href={resolve('/docs/getting-started/docker')}>Docker image</a> or the
			<a href={resolve('/docs/getting-started/single-binary')}>single binary</a>, with
			<Code.Root>POUCHBASE_REGISTRY_URL</Code.Root> added to its server variables.
		</li>
		<li>
			<strong>The Pouchbase repository</strong>, if you work on Pouchbase itself: run
			<Code.Root>pnpm dev</Code.Root> there with the variable set.
		</li>
	</ul>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.devInRepo} />
	</CodeBlock.Root>

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:cloud" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Server code always runs on Cloudflare</Callout.Title>
			<Callout.Description>
				Installing a plugin with server code (a <Code.Root>field.ts</Code.Root>, a
				<Code.Root>provider.ts</Code.Root> or a route) deploys a real Worker to your Cloudflare account,
				even from a Pouchbase on your machine. That Pouchbase needs the Cloudflare credentials it always
				uses (<Code.Root>CLOUDFLARE_ACCOUNT_ID</Code.Root> and <Code.Root
					>CLOUDFLARE_API_TOKEN</Code.Root
				>), and the account needs a <Code.Root>workers.dev</Code.Root> subdomain, or the install fails
				with error 19011. A plugin with only pages deploys nothing.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<p>
		The dev registry only answers on your machine: a Pouchbase deployed to Cloudflare or another
		server can't reach <Code.Root>localhost:4510</Code.Root>. To try a build there, publish it to a
		registry it can reach (see <a href="#registries">Registries</a>).
	</p>

	<p>
		Every build is served as a new prerelease, <Code.Root>&lt;version&gt;-dev.&lt;n&gt;</Code.Root>,
		so Pouchbase sees it as an update of the build it installed: click <strong>Update</strong> on
		the plugin after a change. Pass <Code.Root>--exact-version</Code.Root> to serve the version from
		<Code.Root>package.json</Code.Root> as is.
	</p>

	<h2 id="install">Install a plugin</h2>

	<p>
		Admins search and install plugins on the <strong>Plugins</strong> page of the dashboard, which
		shows what a plugin adds and the network hosts it asks for before installing. Pouchbase
		downloads the bundle, checks it against the integrity hash (<Code.Root>sha256-…</Code.Root>) the
		registry lists for that version and refuses it when it doesn't match. Browse what's published on
		the <a href={resolve('/plugins')}>plugins page</a>.
	</p>

	<ul>
		<li>
			Pouchbase compiles the plugin's components on install, so a component that doesn't compile
			stops the install.
		</li>
		<li>
			A plugin with server code is deployed as a Worker named
			<Code.Root>&lt;instance&gt;-plugin-&lt;id&gt;</Code.Root> (<Code.Root
				>pouchbase-plugin-&lt;id&gt;</Code.Root
			> by default) on the Cloudflare account of the installation, like
			<a href={resolve('/docs/functions')}>functions</a>. Workers on your plan count toward its
			limits. Removing the plugin deletes the Worker.
		</li>
		<li>
			A plugin with a <a href="#settings">required setting</a> is marked
			<strong>Needs settings</strong> until an admin fills it in under <strong>Settings</strong> on its
			row.
		</li>
		<li>
			Installing a newer version replaces the plugin's code and keeps its settings and the settings
			of its sign-in providers (see <a href="#versions-and-compatibility"
				>Compatibility and updates</a
			>).
		</li>
		<li>
			Removing a plugin deletes its settings and lists the fields that use its field types; those
			keep their data (see <a href="#field-types">Field types</a>).
		</li>
		<li>
			Built-in plugins are marked <strong>Built in</strong> and can't be removed; leave their sign-in
			providers disabled when you don't use them. Installing a newer version of a built-in plugin from
			the registry replaces it, and removing that version brings the built-in one back.
		</li>
	</ul>

	<h2 id="project-layout">Project layout</h2>

	<p>The folders of a plugin say what it contributes:</p>

	<CodeBlock.Root>
		<CodeBlock.Source code={data.code.layout} />
	</CodeBlock.Root>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>File</Table.Head>
				<Table.Head>Adds</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each files as { file, adds } (file)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{file}</Code.Root></Table.Cell>
					<Table.Cell>{adds}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<ul>
		<li>
			Names are lowercase. Field types use letters, numbers and underscores (<Code.Root
				>rich_color</Code.Root
			>); pages and providers use lowercase words separated by dashes (<Code.Root
				>monthly-report</Code.Root
			>). Route segments may also use <Code.Root>_</Code.Root> and <Code.Root>.</Code.Root> between letters
			and numbers, so <Code.Root>routes/status.json.ts</Code.Root> answers
			<Code.Root>/status.json</Code.Root>.
		</li>
		<li>
			Files and folders whose name starts with <Code.Root>_</Code.Root>, such as
			<Code.Root>pages/_parts/header.svelte</Code.Root> or <Code.Root>routes/_auth.ts</Code.Root>,
			are never pages or routes, so helpers can live next to the files that use them.
		</li>
		<li>
			Tests (<Code.Root>*.test.ts</Code.Root>, <Code.Root>*.spec.ts</Code.Root>) and declarations (<Code.Root
				>*.d.ts</Code.Root
			>) in <Code.Root>routes/</Code.Root> are ignored.
		</li>
		<li>
			<Code.Root>pages/index.svelte</Code.Root> is refused: a page needs a path below
			<Code.Root>/plugins/&lt;plugin&gt;/</Code.Root>.
		</li>
	</ul>

	<h2 id="the-manifest">The manifest</h2>

	<p><Code.Root>pouchbase-plugin.json</Code.Root> only holds what isn't code:</p>

	<CodeBlock.Root title="pouchbase-plugin.json">
		<CodeBlock.Source code={data.code.manifest} />
	</CodeBlock.Root>

	<ul>
		<li>
			<Code.Root>id</Code.Root> is unique in the registry: lowercase words separated by dashes. Everything
			the plugin adds is namespaced by it, such as the field type <Code.Root
				>color-picker:color</Code.Root
			> and the page <Code.Root>/plugins/color-picker/palette</Code.Root>.
		</li>
		<li><Code.Root>name</Code.Root> is the plugin's name in the marketplace and the dashboard.</li>
		<li>
			<Code.Root>categories</Code.Root> lists up to three of <Code.Root>auth</Code.Root>,
			<Code.Root>fields</Code.Root>, <Code.Root>pages</Code.Root>,
			<Code.Root>integrations</Code.Root> and <Code.Root>developer-tools</Code.Root>, so people find
			the plugin on the <a href={resolve('/plugins')}>plugins page</a> and the Plugins page of their dashboard.
			Without it, the registry picks them from what the plugin contributes.
		</li>
		<li>
			<Code.Root>engines.pouchbase</Code.Root> is the semver range of Pouchbase versions the plugin works
			with. Use <Code.Root>&gt;=0.10.0</Code.Root> for a plugin written with this SDK (see
			<a href="#versions-and-compatibility">Compatibility and updates</a>).
		</li>
		<li>
			<Code.Root>permissions.network</Code.Root> lists the hosts the server code may reach over HTTPS;
			<Code.Root>*.example.com</Code.Root> matches its subdomains, not <Code.Root
				>example.com</Code.Root
			>
			itself. The admin sees them before installing.
		</li>
		<li>
			<Code.Root>icon</Code.Root> is the path of the plugin's SVG icon; it defaults to
			<Code.Root>icon.svg</Code.Root> when there is one. Without one, the plugin gets a puzzle piece.
		</li>
		<li>
			<Code.Root>$schema</Code.Root> points editors at the
			<a href={resolve('/schemas/plugin-manifest.json')}>JSON Schema of the manifest</a>, for
			completion and checks while you type. In the schema, <Code.Root>apiVersion</Code.Root> is optional
			(it defaults to the SDK's), and <Code.Root>contributes</Code.Root>, <Code.Root
				>server</Code.Root
			> and <Code.Root>settings</Code.Root> are marked deprecated: the CLI fills them in from the folders
			and <Code.Root>plugin.ts</Code.Root>.
		</li>
	</ul>

	<p>
		<Code.Root>version</Code.Root>, <Code.Root>description</Code.Root>, <Code.Root
			>license</Code.Root
		>,
		<Code.Root>author</Code.Root>, <Code.Root>homepage</Code.Root>, <Code.Root>repository</Code.Root
		> and
		<Code.Root>keywords</Code.Root> come from the plugin's <Code.Root>package.json</Code.Root>, so
		the version lives in one place (a value in the manifest wins):
	</p>

	<CodeBlock.Root title="package.json">
		<CodeBlock.Source code={data.code.packageDefaults} />
	</CodeBlock.Root>

	<p>
		The CLI turns the folders into the full manifest that Pouchbase and the registry see, with every
		contribution listed. <Code.Root>manifest</Code.Root> prints it, which helps when something isn't picked
		up:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.manifestCommand} />
	</CodeBlock.Root>

	<h2 id="field-types">Field types</h2>

	<p>
		A field type is a folder in <Code.Root>fields/</Code.Root>. Its <Code.Root>field.ts</Code.Root>
		default-exports <Code.Root>defineField(...)</Code.Root>: the CLI reads <Code.Root
			>label</Code.Root
		>,
		<Code.Root>description</Code.Root>, <Code.Root>column</Code.Root> and <Code.Root>icon</Code.Root
		> by running the file in Node.js when it builds, so keep its top level free of anything only the Worker
		has. The rest runs on the server. A minimal color type:
	</p>

	<CodeBlock.Root title="fields/color/field.ts">
		<CodeBlock.Source code={data.code.field} />
	</CodeBlock.Root>

	<ul>
		<li>
			<Code.Root>column</Code.Root> is the SQLite column type: <Code.Root>TEXT</Code.Root>,
			<Code.Root>INTEGER</Code.Root>, <Code.Root>REAL</Code.Root> or <Code.Root>BLOB</Code.Root>. It
			is fixed when a field is created, so changing it later only affects new fields.
		</li>
		<li>
			<Code.Root>validate(value, options, ctx)</Code.Root> checks a value before it is saved. Values from
			the record form are strings; the API may send other JSON, so accept both.
		</li>
		<li>
			<Code.Root>serialize(value, ctx)</Code.Root> turns a valid value into what is stored, and
			<Code.Root>deserialize(value, ctx)</Code.Root> turns the stored value into what the API returns.
		</li>
		<li>
			Each hook is optional. Empty values are stored as <Code.Root>null</Code.Root> without calling the
			plugin.
		</li>
		<li>
			Fields of a plugin type can have a default value. Pouchbase runs it through
			<Code.Root>validate</Code.Root> and <Code.Root>serialize</Code.Root> when the field is saved, and
			uses it for new records without a value.
		</li>
	</ul>

	<p>
		<Code.Root>input.svelte</Code.Root> edits the value in the record form. It gets
		<Code.Root>FieldInputProps</Code.Root> and must submit the value with a form control named
		<Code.Root>name</Code.Root>; use a hidden <Code.Root>&lt;input&gt;</Code.Root> when something else
		edits it:
	</p>

	<CodeBlock.Root title="fields/color/input.svelte">
		<CodeBlock.Source code={data.code.fieldInput} />
	</CodeBlock.Root>

	<p>
		<Code.Root>preview.svelte</Code.Root> is the type's <strong>preview</strong>: it shows the
		value, read-only, in the records grid. It gets <Code.Root>FieldPreviewProps</Code.Root>; without
		one, the grid shows the value as text. Previews used to be called cells: <Code.Root
			>cell.svelte</Code.Root
		>
		and <Code.Root>FieldCellProps</Code.Root> still work in plugin API version 1, and the CLI warns to
		rename them:
	</p>

	<CodeBlock.Root title="fields/color/preview.svelte">
		<CodeBlock.Source code={data.code.fieldPreview} />
	</CodeBlock.Root>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:database" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Removing a plugin keeps the data</Callout.Title>
			<Callout.Description>
				When the plugin of a field type is removed, its fields stay with their data. They become
				read-only: the grid shows the stored value, the API returns it as stored, and writes to the
				field are refused. Installing the plugin again brings the field back.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>

	<h2 id="pages">Pages</h2>

	<p>
		A page is a Svelte component in <Code.Root>pages/</Code.Root>, shown at
		<Code.Root>/plugins/&lt;plugin&gt;/&lt;path&gt;</Code.Root> in the dashboard. Its title, whether it
		gets a link in the sidebar and the <a href="#icons">icon</a> of that link come from
		<Code.Root>page</Code.Root> in its
		<Code.Root>&lt;script module&gt;</Code.Root>:
	</p>

	<CodeBlock.Root title="pages/palette.svelte">
		<CodeBlock.Source code={data.code.page} />
	</CodeBlock.Root>

	<ul>
		<li>
			The CLI reads <Code.Root>page</Code.Root> without running the component, so it must be a literal:
			no variables or function calls, apart from
			<Code.Root>definePage(&#123; … &#125;)</Code.Root> from <Code.Root
				>@pouchbasejs/plugin-sdk/ui</Code.Root
			>, which types it like <Code.Root>satisfies PageMeta</Code.Root>. Without it, the title comes
			from the file name (<Code.Root>monthly-report.svelte</Code.Root>
			is <em>Monthly report</em>) and the page is in the sidebar.
		</li>
		<li>
			<Code.Root>order</Code.Root> sets where a page comes among the plugin's pages, also in the sidebar:
			lower first. Pages without one follow, by path.
		</li>
		<li>
			<Code.Root>params</Code.Root> is the path below the page:
			<Code.Root>['2026', '10']</Code.Root> for <Code.Root
				>/plugins/&lt;plugin&gt;/reports/2026/10</Code.Root
			>.
		</li>
		<li>
			<Code.Root>api.fetch(path, init)</Code.Root> calls the plugin's own
			<a href="#routes">routes</a>
			with the admin's session, so <Code.Root>ctx.admin</Code.Root> is <Code.Root>true</Code.Root> there.
		</li>
	</ul>

	<h2 id="routes">Routes</h2>

	<p>
		A file in <Code.Root>routes/</Code.Root> exports a handler per HTTP method it answers:
		<Code.Root>GET</Code.Root>, <Code.Root>POST</Code.Root>, <Code.Root>PUT</Code.Root>,
		<Code.Root>PATCH</Code.Root> or <Code.Root>DELETE</Code.Root>. It answers at
		<Code.Root>/api/plugins/&lt;plugin&gt;/&lt;path&gt;</Code.Root>; <Code.Root>index.ts</Code.Root>
		answers its folder's path. From the demo plugin:
	</p>

	<CodeBlock.Root title="routes/info.ts">
		<CodeBlock.Source code={data.code.route} />
	</CodeBlock.Root>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.routeCurl} />
	</CodeBlock.Root>

	<p>
		<Code.Root>[name]</Code.Root> in a file or folder name is a param, in <Code.Root
			>ctx.params</Code.Root
		>:
	</p>

	<CodeBlock.Root title="routes/items/[id].ts">
		<CodeBlock.Source code={data.code.routeParams} />
	</CodeBlock.Root>

	<p>
		<Code.Root>ctx.user</Code.Root> is the app user of the request's
		<Code.Root>Authorization: Bearer &lt;token&gt;</Code.Root>:
	</p>

	<CodeBlock.Root title="routes/me.ts">
		<CodeBlock.Source code={data.code.routeUser} />
	</CodeBlock.Root>

	<ul>
		<li>
			Routes are public: anyone can call them. Check <Code.Root>ctx.admin</Code.Root> (an admin in the
			dashboard) or <Code.Root>ctx.user</Code.Root> before doing something that needs either; the
			<a href="#security">security model</a> has the details.
		</li>
		<li>
			A static segment wins over a param (<Code.Root>/items/new</Code.Root> over
			<Code.Root>/items/:id</Code.Root>). A path that exists with another method answers
			<Code.Root>405</Code.Root>, an unknown path <Code.Root>404</Code.Root> (see
			<a href="#debugging">Debugging</a>).
		</li>
		<li>
			Paths below <Code.Root>/assets</Code.Root> and <Code.Root>/modules</Code.Root> belong to Pouchbase,
			which serves the plugin's images and components there.
		</li>
		<li>
			The response comes back as the route returns it, but sandboxed: HTML from a plugin can't run
			scripts on the dashboard's origin.
		</li>
	</ul>

	<h2 id="sign-in-providers">Sign-in providers</h2>

	<p>
		A sign-in provider tells Pouchbase where to send people to sign in and how to read their
		profile. Pouchbase handles the redirects and the token exchange; the plugin's
		<Code.Root>profile</Code.Root> function gets the access token and returns the user. A provider is
		a folder in <Code.Root>auth/</Code.Root> whose <Code.Root>provider.ts</Code.Root> default-exports
		<Code.Root>defineAuthProvider(...)</Code.Root>. For an OpenID Connect provider,
		<Code.Root>createOidcProvider</Code.Root> reads the profile from its userinfo endpoint; scopes default
		to <Code.Root>openid email profile</Code.Root>, PKCE is on, and <Code.Root>mapProfile</Code.Root
		> adjusts the result:
	</p>

	<CodeBlock.Root title="auth/gitlab/provider.ts">
		<CodeBlock.Source code={data.code.authProvider} />
	</CodeBlock.Root>

	<p>
		For other APIs, write <Code.Root>profile</Code.Root> yourself; <Code.Root>fetchJson</Code.Root> sends
		the access token and throws when the request fails:
	</p>

	<CodeBlock.Root title="auth/github/provider.ts">
		<CodeBlock.Source code={data.code.authProviderProfile} />
	</CodeBlock.Root>

	<ul>
		<li>
			Only set <Code.Root>emailVerified</Code.Root> when the provider guarantees the email belongs to
			the user: a verified email links a sign-in to an existing user with that email.
		</li>
		<li>
			Add the hosts <Code.Root>profile</Code.Root> calls to <Code.Root
				>permissions.network</Code.Root
			>. Pouchbase reads the URLs, scopes and PKCE setting once, when the plugin is installed.
		</li>
		<li>
			The folder name is the provider's public id, such as <Code.Root>gitlab</Code.Root>, used as is
			in the sign-in URLs and the API. Pouchbase refuses to install a plugin whose provider id
			another plugin already contributes, including the built-in ones. <Code.Root
				>password</Code.Root
			>,
			<Code.Root>email</Code.Root> and <Code.Root>otp</Code.Root> are reserved.
		</li>
		<li>
			<Code.Root>icon.svg</Code.Root> next to <Code.Root>provider.ts</Code.Root> is shown on the sign-in
			button and in the settings.
		</li>
	</ul>

	<p>
		The built-in sign-in providers are ordinary plugins in the
		<a href="https://github.com/pouchbase/pouchbase/tree/main/plugins"
			><Code.Root>plugins/</Code.Root> folder</a
		>
		of the Pouchbase repository, built with the same SDK. They are good examples to start from:
		<Code.Root>auth-github</Code.Root> reads a REST API with <Code.Root>fetchJson</Code.Root>, and
		<Code.Root>auth-twitch</Code.Root> sends the client id along.
	</p>

	<h2 id="settings">Settings</h2>

	<p>
		Settings are values an admin enters on the <strong>Plugins</strong> page, such as an API key or
		a region. They are code, so they are typed: <Code.Root>plugin.ts</Code.Root> at the root of the plugin
		default-exports <Code.Root>definePlugin(&#123; settings &#125;)</Code.Root> with up to 30 of them,
		and the CLI puts them into the manifest, from which Pouchbase builds the settings form. The <Code.Root
			>Register</Code.Root
		> block at the end types <Code.Root>ctx.settings</Code.Root>
		everywhere in the plugin; keep <Code.Root>plugin.ts</Code.Root> in the
		<Code.Root>include</Code.Root> of <Code.Root>tsconfig.json</Code.Root> (the templates do):
	</p>

	<CodeBlock.Root title="plugin.ts">
		<CodeBlock.Source code={data.code.setting} />
	</CodeBlock.Root>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Key</Table.Head>
				<Table.Head>What it is</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each settingKeys as { key, about } (key)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{key}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		<Code.Root>ctx.settings.get(key)</Code.Root> returns a promise of the saved value, else the
		<Code.Root>default</Code.Root>, else <Code.Root>null</Code.Root>, parsed by its type: a
		<Code.Root>number</Code.Root> setting gives a number, a <Code.Root>boolean</Code.Root> setting a boolean,
		the others a string.
	</p>

	<ul>
		<li>
			Only a setting with a <Code.Root>default</Code.Root> is never <Code.Root>null</Code.Root> in its
			type.
		</li>
		<li>
			A <Code.Root>required</Code.Root> setting without a default is
			<Code.Root>| null</Code.Root> until an admin saves it, so handle <Code.Root>null</Code.Root>;
			meanwhile the dashboard marks the plugin <strong>Needs settings</strong>.
		</li>
		<li>
			A key that <Code.Root>plugin.ts</Code.Root> doesn't declare is a type error. Without the
			<Code.Root>Register</Code.Root> block, <Code.Root>get</Code.Root> takes any key and returns
			<Code.Root>string | number | boolean | null</Code.Root>.
		</li>
	</ul>

	<CodeBlock.Root title="routes/status.ts">
		<CodeBlock.Source code={data.code.readSetting} />
	</CodeBlock.Root>

	<p>
		<Code.Root>add setting</Code.Root> writes a setting for you. The CLI checks the settings like the
		rest of the manifest, and refuses a <Code.Root>settings</Code.Root> key in
		<Code.Root>pouchbase-plugin.json</Code.Root>: they live in <Code.Root>plugin.ts</Code.Root>.
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.addSetting} />
	</CodeBlock.Root>

	<p>
		Settings are not copied between Pouchbase instances, such as from staging to production, since
		they may hold secrets: fill them in on every instance.
	</p>

	<h2 id="icons">Icons</h2>

	<p>
		Field types and pages have their own icon in the dashboard, drawn like its built-in icons: in
		the text color, at 16 pixels, in the add-field dialog, the field list, the grid headers and the
		sidebar. Only the shape counts, so monochrome icons work best. Without one, a field type or page
		shows a puzzle piece; the plugin's <Code.Root>icon.svg</Code.Root> is its logo in the marketplace,
		never the icon of a field type or page.
	</p>

	<CodeBlock.Root title="fields/*/field.ts">
		<CodeBlock.Source code={data.code.icons} />
	</CodeBlock.Root>

	<ul>
		<li>
			An <a href="https://icon-sets.iconify.design">Iconify</a> name, such as
			<Code.Root>lucide:palette</Code.Root>, becomes an SVG file of the bundle when the CLI builds,
			so Pouchbase never fetches an icon. The SDK comes with <Code.Root>lucide</Code.Root>, the
			dashboard's own set; for another set, install <Code.Root>@iconify-json/&lt;set&gt;</Code.Root
			>, or the CLI fetches the icon from the Iconify API once and caches it.
		</li>
		<li>
			A path is an <Code.Root>.svg</Code.Root> file of the plugin, relative to the file that names it.
			Without <Code.Root>icon</Code.Root>, the CLI uses <Code.Root
				>fields/&lt;type&gt;/icon.svg</Code.Root
			>
			for a field type and <Code.Root>pages/&lt;path&gt;.svg</Code.Root> for a page, when there is one.
		</li>
		<li>
			Icons are plain SVG images of at most 32 KiB: no scripts, event handlers or references to
			other files. <Code.Root>validate</Code.Root>, <Code.Root>build</Code.Root> and Pouchbase refuse
			others.
		</li>
	</ul>

	<p>
		Inside a component, <Code.Root>Icon.Root</Code.Root> from <Code.Root
			>@pouchbasejs/ui/icon</Code.Root
		> draws an icon:
	</p>

	<ul>
		<li>
			<Code.Root>src</Code.Root> takes the URL of an SVG image, such as a <Code.Root
				>data:</Code.Root
			>
			URL of markup in a <Code.Root>.ts</Code.Root> module, or an icon of one of the plugin's field types
			or pages, which Pouchbase serves at
			<Code.Root>/api/plugins/&lt;plugin&gt;/assets/&lt;bundle path&gt;</Code.Root>. This always
			works, offline too.
		</li>
		<li>
			<Code.Root>icon="lucide:…"</Code.Root> renders at once only for icons the dashboard bundles for
			its own use. Any other name is fetched from the Iconify API by the admin's browser, so it shows
			late, or not at all offline, and which names the dashboard bundles can change between versions.
			Prefer <Code.Root>src</Code.Root>.
		</li>
	</ul>

	<CodeBlock.Root title="pages/palette.svelte">
		<CodeBlock.Source code={data.code.iconSrc} />
	</CodeBlock.Root>

	<h2 id="ui-components">UI components</h2>

	<p>
		Pouchbase compiles the plugin's <Code.Root>.svelte</Code.Root> files with its own Svelte compiler
		when the plugin is installed, and renders them in the dashboard, in the browser only. They get their
		props from <Code.Root>@pouchbasejs/plugin-sdk/ui</Code.Root>:
		<Code.Root>FieldInputProps</Code.Root>, <Code.Root>FieldPreviewProps</Code.Root> and
		<Code.Root>PageProps</Code.Root>. A component that doesn't compile stops the install, and one
		that fails while rendering shows an error in its place instead of breaking the page.
	</p>

	<p>
		A component or module may import, with static <Code.Root>import</Code.Root> statements only:
	</p>

	<ul>
		<li>
			other <Code.Root>.svelte</Code.Root>, <Code.Root>.ts</Code.Root> and <Code.Root>.js</Code.Root
			> files of the plugin, by relative path;
		</li>
		<li>exactly these modules, which Pouchbase provides at runtime:</li>
	</ul>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>From</Table.Head>
				<Table.Head>Modules</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each hostModules as { group, modules } (group)}
				<Table.Row>
					<Table.Cell class="whitespace-nowrap">{group}</Table.Cell>
					<Table.Cell>
						{#each modules as module, index (module)}
							<Code.Root>{module}</Code.Root>{index < modules.length - 1 ? ', ' : ''}
						{/each}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<ul>
		<li>
			Nothing else: no other packages (they aren't in the browser), no dynamic
			<Code.Root>import()</Code.Root>, no files outside the plugin. <Code.Root>validate</Code.Root>
			applies exactly the rules Pouchbase applies on install, and compiles every component with Svelte,
			so it reports what would stop the install, with <Code.Root>file:line:column</Code.Root>.
		</li>
		<li>
			Pouchbase provides those modules in the versions the dashboard uses, so a plugin never ships
			its own copy; install <Code.Root>svelte</Code.Root> and <Code.Root>@pouchbasejs/ui</Code.Root> as
			devDependencies for type checking (the templates do).
		</li>
		<li>
			Import shared TypeScript such as <Code.Root>lib/colors.ts</Code.Root> by its <Code.Root
				>.js</Code.Root
			>
			name (<Code.Root>../../lib/colors.js</Code.Root>), as it is in the bundle. Server files (<Code.Root
				>field.ts</Code.Root
			>, <Code.Root>provider.ts</Code.Root>, <Code.Root>routes/</Code.Root>,
			<Code.Root>plugin.ts</Code.Root>) can't be imported: move what both need into
			<Code.Root>lib/</Code.Root>.
		</li>
		<li>
			Only JavaScript is linked: put styles in the component's <Code.Root>&lt;style&gt;</Code.Root> (scoped
			to it, so it can't break the dashboard), inline JSON data in a <Code.Root>.ts</Code.Root> module
			and SVG markup in a component or a string.
		</li>
		<li>
			Style components with Tailwind classes, as the dashboard does: the CLI compiles the classes
			they use into <Code.Root>ui/tailwind.css</Code.Root> of the bundle, with the dashboard's design
			tokens (<Code.Root>h-control</Code.Root>, <Code.Root>h-row</Code.Root>, …) from
			<Code.Root>@pouchbasejs/ui</Code.Root> 0.2 or later. Only the utilities are compiled, in the dashboard's
			layers, so a class means the same as in the dashboard.
		</li>
		<li>For <Code.Root>Icon.Root</Code.Root>, see <a href="#icons">Icons</a>.</li>
	</ul>

	<h2 id="server-code">Server code</h2>

	<p>
		The field types, sign-in providers and routes are bundled into one module that runs in its own
		Worker on your Cloudflare account (built-in plugins, which ship with Pouchbase, run inside
		Pouchbase).
	</p>

	<ul>
		<li>
			It can't reach the network, except through <Code.Root>ctx.fetch</Code.Root> to the HTTPS hosts in
			<Code.Root>permissions.network</Code.Root>; the global <Code.Root>fetch</Code.Root> and
			<Code.Root>WebSocket</Code.Root> have the same limits, and redirects are returned instead of followed.
		</li>
		<li>The Worker has no bindings: no database, storage or secrets other than its settings.</li>
		<li>
			Packages a server file imports are bundled into it on <Code.Root>build</Code.Root>, so install
			them. The bundle itself may not import anything, not even <Code.Root>cloudflare:*</Code.Root> or
			<Code.Root>node:*</Code.Root> modules.
		</li>
	</ul>

	<p>From the demo plugin:</p>

	<CodeBlock.Root title="routes/github-status.ts">
		<CodeBlock.Source code={data.code.outsideApi} />
	</CodeBlock.Root>

	<p>Every handler gets <Code.Root>ctx</Code.Root>:</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Member</Table.Head>
				<Table.Head>What it is</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each context as { member, about } (member)}
				<Table.Row>
					<Table.Cell><Code.Root class="whitespace-nowrap">{member}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<h2 id="testing">Testing</h2>

	<p>
		Field hooks, sign-in providers and routes are plain functions of a value or a request and
		<Code.Root>ctx</Code.Root>, so test them with any test runner in Node.js.
		<Code.Root>fakeContext</Code.Root> from <Code.Root>@pouchbasejs/plugin-sdk/testing</Code.Root>
		builds the <Code.Root>ctx</Code.Root> Pouchbase would pass:
	</p>

	<ul>
		<li>
			<Code.Root>ctx.fetch</Code.Root> answers from canned <Code.Root>responses</Code.Root> by URL (or
			<Code.Root>"POST https://…"</Code.Root>), and, like Pouchbase, throws for a host outside
			<Code.Root>permissions.network</Code.Root> of the <Code.Root>manifest</Code.Root>, wildcards
			such as <Code.Root>*.example.com</Code.Root> included. <Code.Root>requests</Code.Root> lists what
			it was asked.
		</li>
		<li>
			<Code.Root>ctx.settings</Code.Root> parses the saved <Code.Root>settings</Code.Root> (strings, as
			Pouchbase stores them) by the definitions of <Code.Root>plugin</Code.Root>, with their
			defaults.
		</li>
		<li>
			<Code.Root>admin</Code.Root>, <Code.Root>user</Code.Root> and <Code.Root>params</Code.Root> set
			the rest; <Code.Root>logs</Code.Root> collects what <Code.Root>ctx.log</Code.Root> wrote.
		</li>
	</ul>

	<CodeBlock.Root title="test/routes.test.ts">
		<CodeBlock.Source code={data.code.testRoute} />
	</CodeBlock.Root>

	<CodeBlock.Root title="test/color.test.ts">
		<CodeBlock.Source code={data.code.testField} />
	</CodeBlock.Root>

	<CodeBlock.Root title="test/settings.test.ts">
		<CodeBlock.Source code={data.code.testSettings} />
	</CodeBlock.Root>

	<p>
		Every template comes with a test in <Code.Root>test/</Code.Root> and these scripts:
		<Code.Root>pnpm test</Code.Root> runs the tests with <Code.Root>vitest</Code.Root>, and
		<Code.Root>pnpm check</Code.Root> type-checks the TypeScript and the
		<Code.Root>.svelte</Code.Root> files with <Code.Root>svelte-check</Code.Root> (plain
		<Code.Root>tsc</Code.Root> skips components). <Code.Root>validate</Code.Root> also compiles the components,
		as Pouchbase will:
	</p>

	<CodeBlock.Root title="package.json">
		<CodeBlock.Source code={data.code.testScripts} />
	</CodeBlock.Root>

	<p>
		Components need a dashboard to run: try them in Pouchbase with <a href="#test-locally"
			><Code.Root>pnpm dev</Code.Root></a
		>.
	</p>

	<h2 id="debugging">Debugging</h2>

	<p>Where to look depends on where the code runs:</p>

	<ul>
		<li>
			<strong>Server code of an installed plugin</strong> runs in its Worker,
			<Code.Root>&lt;instance&gt;-plugin-&lt;id&gt;</Code.Root>. <Code.Root>ctx.log</Code.Root>,
			<Code.Root>console</Code.Root> and uncaught errors go to that Worker's logs: open it under
			<strong>Workers &amp; Pages</strong> in the Cloudflare dashboard, or follow them live with
			<Code.Root>wrangler tail</Code.Root>. Lines start with <Code.Root
				>[plugin &lt;id&gt;]</Code.Root
			>.
		</li>
		<li>
			<strong>Built-in plugins</strong> run inside Pouchbase, so their logs are in the Pouchbase log.
		</li>
		<li>
			<strong>What Pouchbase saw</strong>, such as why a route failed, is in the Pouchbase log (the
			terminal of <Code.Root>pnpm dev</Code.Root> or <Code.Root>docker logs</Code.Root>, or the
			Pouchbase Worker's logs on Cloudflare).
		</li>
		<li>
			<strong>Components</strong> run in the admin's browser: errors are in its developer console,
			starting with <Code.Root>[plugins] &lt;plugin&gt; failed</Code.Root>, and the component shows
			<em>&lt;plugin&gt; failed: &lt;message&gt;</em> in its place.
		</li>
	</ul>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.debugLogs} />
	</CodeBlock.Root>

	<p>
		A route that throws gives the caller only a <Code.Root>502</Code.Root>; the reason is never sent
		to the client, only written to the Pouchbase log:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.routeErrors} />
	</CodeBlock.Root>

	<p>What Pouchbase answers for a plugin route:</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Status</Table.Head>
				<Table.Head>Means</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each routeStatuses as { status, about } (status)}
				<Table.Row>
					<Table.Cell><Code.Root>{status}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		Before installing, <Code.Root>validate</Code.Root> catches most problems; every error names the file,
		what is wrong and how to fix it (see <a href="#the-cli">The CLI</a>). Common ones:
	</p>

	<ul>
		<li>
			<Code.Root
				>fields/rating: has no input.svelte: every field type needs an input component</Code.Root
			>
		</li>
		<li>
			<Code.Root
				>pages/hello.svelte: imports lodash, which Pouchbase doesn't provide; UI files may only
				import svelte (…), @pouchbasejs/plugin-sdk/ui, @pouchbasejs/ui and its components (…) and
				other files of the plugin</Code.Root
			>: the hint lists every module Pouchbase provides (see
			<a href="#ui-components">UI components</a>). An <Code.Root>@pouchbasejs/ui/…</Code.Root> path the
			dashboard doesn't have, such as <Code.Root>@pouchbasejs/ui/dialog</Code.Root>, gets the same
			error.
		</li>
		<li>
			<Code.Root
				>pages/hello.svelte: imports ./chart.js with import(); UI files may only use static imports</Code.Root
			>
		</li>
		<li>
			<Code.Root
				>imports ../../lib/colors.ts; import TypeScript modules by their .js name
				(../../lib/colors.js), as they are in the bundle</Code.Root
			>
		</li>
		<li>
			<Code.Root
				>imports routes/stats.ts, which is server code; move what both need into a shared file, e.g.
				lib/</Code.Root
			>
		</li>
		<li>
			<Code.Root>"settings" belongs in plugin.ts in the convention layout</Code.Root>
		</li>
		<li>
			<Code.Root
				>Problems in the UI files · pages/hello.svelte:29:13: Unterminated regular expression</Code.Root
			>: a Svelte compile error, at its line and column. <Code.Root>validate</Code.Root> compiles with
			the plugin's own <Code.Root>svelte</Code.Root>, so keep it a devDependency; without it, it
			warns and these errors only show on install.
		</li>
	</ul>

	<p>When an install fails, the dashboard says why:</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Message</Table.Head>
				<Table.Head>What to do</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each installErrors as { message, about } (message)}
				<Table.Row>
					<Table.Cell>{message}</Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<h2 id="publish">Publish</h2>

	<p>
		Published plugins are listed in the public registry on pouchbase.io, which every Pouchbase
		installation searches by default. To publish, you need an account on
		<a href={resolve('/account')}>pouchbase.io</a>. The first version of a plugin makes its id
		yours; after that, only you can publish new versions of it.
	</p>

	<p>First check the plugin and build its bundle:</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.build} />
	</CodeBlock.Root>

	<p>
		<Code.Root>build</Code.Root> writes one JSON file to <Code.Root>dist/</Code.Root>: the full
		manifest, the bundled server code and the UI files, at most 1 MiB. Then publish it in one of two
		ways:
	</p>

	<ul>
		<li>
			<strong>Upload it.</strong> Under <a href={resolve('/account')}>Account</a>, upload the bundle
			in <strong>Publish a version</strong>.
		</li>
		<li>
			<strong>With the CLI.</strong> Create a token under <strong>Publish tokens</strong> on the
			account page and set it as <Code.Root>POUCHBASE_REGISTRY_TOKEN</Code.Root> (or pass
			<Code.Root>--token</Code.Root>). <Code.Root>publish</Code.Root> checks the token, builds the plugin,
			looks it up on the registry and uploads the bundle:
		</li>
	</ul>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.publish} />
	</CodeBlock.Root>

	<p>
		A token publishes as you, so keep it secret. In CI, store it as a secret and publish on every
		release with <Code.Root>--quiet</Code.Root>:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.ci} />
	</CodeBlock.Root>

	<p>The registry refuses a version when:</p>

	<ul>
		<li>there is no valid token (<Code.Root>401</Code.Root>);</li>
		<li>the plugin id belongs to another account (<Code.Root>403</Code.Root>);</li>
		<li>
			that version is already published (<Code.Root>409</Code.Root>): published versions never
			change, so bump <Code.Root>version</Code.Root> in <Code.Root>package.json</Code.Root> for every
			release. The CLI checks this before uploading;
		</li>
		<li>the bundle is larger than 1 MiB (<Code.Root>413</Code.Root>);</li>
		<li>
			the bundle isn't valid, has an unknown category or is for an API version it doesn't know (<Code.Root
				>422</Code.Root
			>).
		</li>
	</ul>

	<h2 id="the-cli">The CLI</h2>

	<p>
		Run the commands with <Code.Root>npx pouchbase-plugin &lt;command&gt;</Code.Root> or through the scripts
		in the plugin's <Code.Root>package.json</Code.Root>:
	</p>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Command</Table.Head>
				<Table.Head>What it does</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each commands as { command, about } (command)}
				<Table.Row>
					<Table.Cell><Code.Root>{command}</Code.Root></Table.Cell>
					<Table.Cell>{about}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		Every command reports what it does (<Code.Root>›</Code.Root>), what it found, how it ended (<Code.Root
			>✓</Code.Root
		> or <Code.Root>✗</Code.Root>) and what to do next. This is <Code.Root>validate</Code.Root> on the
		demo plugin:
	</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.validate} />
	</CodeBlock.Root>

	<p>An error names the file it concerns and how to fix it:</p>

	<CodeBlock.Root title="Terminal">
		<CodeBlock.Source code={data.code.validateError} />
	</CodeBlock.Root>

	<p>
		Results go to stdout, warnings (<Code.Root>!</Code.Root>) and errors to stderr, with colors only
		in a terminal (<Code.Root>NO_COLOR</Code.Root> turns them off). <Code.Root>-q</Code.Root>,
		<Code.Root>--quiet</Code.Root> prints only results, warnings and errors, for CI;
		<Code.Root>-v</Code.Root>, <Code.Root>--verbose</Code.Root> adds stack traces and every request to
		the dev registry.
	</p>

	<h2 id="limits">Limits</h2>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>What</Table.Head>
				<Table.Head>Limit</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each limits as { limit, value } (limit)}
				<Table.Row>
					<Table.Cell class="whitespace-nowrap">{limit}</Table.Cell>
					<Table.Cell>{value}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<p>
		Plugin Workers also follow the limits of your Cloudflare Workers plan, such as the CPU time per
		request and the number of Workers per account, and count toward its usage. On Pouchbase hosted
		on Workers, installing a plugin compiles its components inside Pouchbase's own request; for a
		plugin with many or large components this can take more CPU time than the Workers Free plan
		allows, and the install fails. The Workers Paid plan allows far more. See
		<a href="https://developers.cloudflare.com/workers/platform/limits/"
			>Cloudflare's Workers limits</a
		>.
	</p>

	<h2 id="security">Security model</h2>

	<p>What a plugin can and can't do, in one place:</p>

	<ul>
		<li>
			<strong>Routes are public.</strong> Anyone can call
			<Code.Root>/api/plugins/&lt;id&gt;/…</Code.Root>, from any origin: responses carry
			<Code.Root>Access-Control-Allow-Origin: *</Code.Root> unless the plugin sets its own CORS headers.
			Check <Code.Root>ctx.admin</Code.Root> or <Code.Root>ctx.user</Code.Root> yourself.
		</li>
		<li>
			<strong><Code.Root>ctx.admin</Code.Root></strong> is <Code.Root>true</Code.Root> only with an admin's
			session <em>and</em> a same-origin request (<Code.Root>Sec-Fetch-Site: same-origin</Code.Root> or
			<Code.Root>none</Code.Root>), as <Code.Root>api.fetch</Code.Root> from a page makes, so another
			site can't act as the admin.
		</li>
		<li>
			<strong>The admin's cookie never reaches the plugin.</strong> Pouchbase removes the
			<Code.Root>Cookie</Code.Root> header (and its own <Code.Root>x-pouchbase-plugin-*</Code.Root> headers)
			before forwarding a request.
		</li>
		<li>
			<strong><Code.Root>ctx.user</Code.Root></strong> comes from the request's
			<Code.Root>Authorization: Bearer &lt;token&gt;</Code.Root>. An invalid or expired token gets a
			<Code.Root>401</Code.Root> before the plugin runs; API keys are not users, and a request with one
			has no <Code.Root>ctx.user</Code.Root>.
		</li>
		<li>
			<strong>Responses are sandboxed.</strong> Pouchbase adds
			<Code.Root>Content-Security-Policy: sandbox</Code.Root> and
			<Code.Root>X-Content-Type-Options: nosniff</Code.Root>, so HTML or SVG from a plugin runs no
			scripts on the dashboard's origin.
		</li>
		<li>
			<strong>Only GET, POST, PUT, PATCH and DELETE</strong> are routable; HEAD gets
			<Code.Root>405</Code.Root>.
		</li>
		<li>
			<strong>Network.</strong> The plugin's Worker replaces <Code.Root>fetch</Code.Root> and
			<Code.Root>WebSocket</Code.Root> before any plugin code runs, so both only reach HTTPS (or WSS)
			hosts in <Code.Root>permissions.network</Code.Root>, and redirects aren't followed. The bundle
			may import nothing, so other Workers APIs (such as <Code.Root>cloudflare:sockets</Code.Root>)
			aren't reachable either.
		</li>
		<li>
			<strong>No access to Pouchbase.</strong> The Worker has no bindings: it can't read the database,
			storage or Pouchbase's secrets. Pouchbase only sends it the data of each call: the value to check,
			the request, the settings.
		</li>
		<li>
			<strong>Settings, secrets included, reach the plugin's Worker in plain text</strong> with
			every call, because the plugin needs them. A <Code.Root>secret</Code.Root> is only hidden in the
			dashboard once saved. Install only plugins you trust with the keys you give them.
		</li>
		<li>
			<strong>Components run in the dashboard</strong>, in the admin's browser, with the dashboard's
			privileges. Pouchbase compiles them itself and links only the modules above, but a component
			can still do anything the admin can do in the dashboard. This is the most important reason to
			install only plugins you trust.
		</li>
	</ul>

	<h2 id="versions-and-compatibility">Compatibility and updates</h2>

	<p>
		An update installs a newer version over the old one: the plugin's code, components and Worker
		are replaced.
	</p>

	<ul>
		<li>
			<strong>Kept:</strong> the records and the values in fields of the plugin's types, the
			settings an admin saved (by key) and the settings of its sign-in providers. A field keeps the
			<Code.Root>column</Code.Root> type it was created with, whatever the new version says.
		</li>
		<li>
			<strong>Renaming or removing a setting</strong> loses its value: the new key starts empty, or at
			its default, until an admin saves it again.
		</li>
		<li>
			<strong>Renaming or removing a field type</strong> orphans the fields of the old type: they keep
			their data but become read-only, as when the plugin is removed. Never rename a field type, or a
			sign-in provider, once people use it.
		</li>
		<li>
			<strong>Changing <Code.Root>serialize</Code.Root></strong> only affects values saved from then
			on; stored values are never rewritten, so <Code.Root>deserialize</Code.Root> and the preview must
			keep reading the old form.
		</li>
		<li>
			<strong>Routes and pages</strong> are public paths: renaming one breaks the apps, webhooks and bookmarks
			that use it.
		</li>
	</ul>

	<p>
		Set <Code.Root>engines.pouchbase</Code.Root> to the lowest Pouchbase version that has everything the
		plugin uses; Pouchbase only installs a version whose range it satisfies. What this page describes,
		such as the folder layout, previews and Tailwind classes, ships with Pouchbase 0.10.0, so start from
		<Code.Root>&gt;=0.10.0</Code.Root> and raise it when you use something newer.
	</p>

	<ul>
		<li>
			<Code.Root>apiVersion</Code.Root> covers the whole contract: the manifest, the project layout, the
			bundle format, the server API, the component props and the modules Pouchbase provides to components.
			It defaults to the SDK's version.
		</li>
		<li>
			Within an API version, changes are only additive. Pouchbase ignores what it doesn't know, so a
			plugin that needs something added later sets <Code.Root>engines.pouchbase</Code.Root>.
		</li>
		<li>
			A change that would break plugins bumps the API version. Pouchbase supports the current API
			version and the one before it, and refuses plugins it can't run.
		</li>
	</ul>

	<p>
		Plugins written before the folder layout list their contributions in <Code.Root
			>contributes</Code.Root
		>
		and point <Code.Root>server</Code.Root> at an entry that default-exports
		<Code.Root>definePlugin(...)</Code.Root>, with every component in <Code.Root>ui/</Code.Root>:
	</p>

	<CodeBlock.Root title="pouchbase-plugin.json (deprecated)">
		<CodeBlock.Source code={data.code.legacy} />
	</CodeBlock.Root>

	<p>
		Such a manifest still builds, with a deprecation warning, and stops working in plugin API
		version 2. It can't be mixed with the folders. To move a plugin, put each contribution in its
		folder, remove <Code.Root>contributes</Code.Root> and <Code.Root>server</Code.Root>, and compare
		the result with <Code.Root>pouchbase-plugin manifest</Code.Root>; the
		<a href="https://github.com/pouchbase/pouchbase/tree/main/packages/plugin-sdk#legacy-layout"
			>SDK README</a
		> has the details.
	</p>

	<h2 id="registries">Registries</h2>

	<p>
		Pouchbase and the CLI use the public registry, <Code.Root>https://api.pouchbase.io</Code.Root>,
		unless <Code.Root>POUCHBASE_REGISTRY_URL</Code.Root> says otherwise: as a server variable of an installation,
		it decides where the Plugins page searches and installs from; for the CLI, where
		<Code.Root>publish</Code.Root> uploads to (or pass <Code.Root>--registry &lt;url&gt;</Code.Root
		>). One installation uses one registry at a time.
	</p>

	<p>
		Any server that implements the registry API can be a registry, for example for private plugins;
		the dev registry of <Code.Root>pouchbase-plugin dev</Code.Root> is a small one. The endpoints, their
		responses and the bundle format are in the
		<a href="https://github.com/pouchbase/pouchbase/tree/main/packages/plugin-sdk#registry-api"
			>SDK README</a
		>.
	</p>

	<Callout.Root variant="info">
		<Callout.Icon><Icon.Root icon="lucide:scale" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>Any license</Callout.Title>
			<Callout.Description>
				The plugin SDK is MIT-licensed, and plugins may use any license under the
				<a href="https://github.com/pouchbase/pouchbase/blob/main/PLUGIN-EXCEPTION.md"
					>Pouchbase Plugin Exception</a
				>.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>
</DocsPage>
