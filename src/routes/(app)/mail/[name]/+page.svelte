<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Page from '#lib/components/ui/page/index.js';
	import { currentUser } from '../../../(auth)/auth.remote';
	import { getMailSender, getMailTemplate } from '../mail.remote';
	import TemplateEditor from './template-editor.svelte';

	const name = $derived(page.params.name ?? '');
	const [template, sender, user] = $derived(
		await Promise.all([getMailTemplate(name), getMailSender(), currentUser()])
	);
</script>

<svelte:head>
	<title>{template.name} · Mail · Pouchbase</title>
</svelte:head>

<Page.Layout
	title={template.name}
	parents={[{ label: 'Mail', href: resolve('/(app)/mail') }]}
	description={template.description || undefined}
	width="wide"
>
	{#snippet badges()}
		<Badge.Root variant="outline">
			{template.content.editor === 'visual' ? 'Visual' : 'HTML'}
		</Badge.Root>
		{#if template.system}
			<Badge.Root variant="outline">Built-in</Badge.Root>
		{/if}
	{/snippet}

	<!-- A save or reset starts the editor again from the stored template. -->
	{#key template.updatedAt?.getTime() ?? 0}
		<TemplateEditor {template} from={sender.from} adminEmail={user?.email ?? ''} />
	{/key}
</Page.Layout>
