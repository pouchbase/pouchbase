<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../docs-page.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'make-a-template', title: 'Make a template' },
		{ id: 'variables', title: 'Variables' },
		{ id: 'send-a-template', title: 'Send a template' },
		{ id: 'built-in-emails', title: 'Built-in emails' }
	];
</script>

<DocsPage
	title="Email templates"
	description="Design emails with variables in the dashboard, and send them from your functions or back-end with one call."
	{sections}
>
	<h2 id="make-a-template">Make a template</h2>

	<p>
		Create templates on the <strong>Mail</strong> page of the dashboard. A template has a name (lowercase
		letters, digits and dashes, which your code sends it by), a subject and a body, made in one of two
		editors:
	</p>

	<ul>
		<li>
			The <strong>visual editor</strong>: formatted text, plus blocks from <strong>Insert</strong>
			(buttons, images, sections with a background, columns that stack on phones, spacers and dividers).
			The side panel styles the selected block, or the whole email when nothing is selected. The output
			is tables with inline styles, so it looks the same in every mail client.
		</li>
		<li>
			<strong>HTML</strong>: the whole document in a code editor. A visual template can be turned
			into HTML at any time.
		</li>
	</ul>

	<p>
		The <strong>preview text</strong> shows next to the subject in the inbox. The
		<strong>Preview</strong> tab fills in the <strong>sample data</strong> (a JSON object), and
		<strong>Send test</strong> sends the email as it is in the editor to you. Every email also gets
		a plain-text version. Sending needs mail settings (Cloudflare Email Service or SMTP) under
		<strong>Sending</strong> on the same page.
	</p>

	<h2 id="variables">Variables</h2>

	<p>Subjects and bodies use variables in double braces. Values are HTML-escaped.</p>

	<CodeBlock.Root title="welcome">
		<CodeBlock.Source code={data.code.variables} />
	</CodeBlock.Root>

	<ul>
		<li>
			<Code.Root>{'{{ name }}'}</Code.Root>, <Code.Root>{'{{ trial.endsOn }}'}</Code.Root>: a value,
			or a field of an object.
		</li>
		<li>
			<Code.Root>{'{{ name | there }}'}</Code.Root>: with a fallback for a missing or empty value.
		</li>
		<li>
			<Code.Root>{'{{#if trial}} … {{else}} … {{/if}}'}</Code.Root>: shown when the value is truthy;
			an empty list counts as false.
		</li>
		<li>
			<Code.Root>{'{{#each items}} … {{else}} … {{/each}}'}</Code.Root>: repeated per item. Inside,
			<Code.Root>{'{{ this }}'}</Code.Root> is the item, names are its fields first and otherwise the
			outer variables, and <Code.Root>{'{{ @index }}'}</Code.Root> and
			<Code.Root>{'{{ @number }}'}</Code.Root> count from 0 and from 1.
		</li>
	</ul>

	<p>
		In the visual editor, put a block tag in a paragraph or list item of its own; it may span
		several paragraphs or repeat the items of a list. A variable outside <Code.Root>#if</Code.Root> and
		loops, without a fallback, is <strong>required</strong>; the editor lists which are.
	</p>

	<h2 id="send-a-template">Send a template</h2>

	<p>
		Sending needs an <a href={resolve('/docs/platform/api-keys')}>API key</a>, not a user's token:
		the <Code.Root>env.POUCHBASE_API_KEY</Code.Root> of a
		<a href={resolve('/docs/platform/functions')}>function</a>, or a key of your own back-end. A
		send names the template, up to 50 addresses and the variables; every recipient gets an email of
		their own. Instead of a template, a send can carry its own subject and HTML.
	</p>

	<ul>
		<li>
			With TypeScript, call <a href={resolve('/docs/sdk/mail')}
				><Code.Root>pouch.mail.send()</Code.Root></a
			>.
		</li>
		<li>
			From anywhere else, call <a href={resolve('/docs/api/mail')}
				><Code.Root>POST /api/mail/send</Code.Root></a
			>.
		</li>
	</ul>

	<p>
		A send fails while mail isn't set up, or without a required variable, with an issue per missing
		one.
	</p>

	<h2 id="built-in-emails">Built-in emails</h2>

	<p>
		The emails Pouchbase sends itself, <Code.Root>verification</Code.Root> and
		<Code.Root>password-reset</Code.Root> (see
		<a href={resolve('/docs/platform/authentication')}>Authentication</a>), are templates too, with
		the variables <Code.Root>{'{{ url }}'}</Code.Root> and <Code.Root>{'{{ email }}'}</Code.Root>.
		Edit them like any other template, or reset them to the original. They can't be deleted or sent
		through the API.
	</p>
</DocsPage>
