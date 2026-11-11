<script lang="ts">
	import { untrack } from 'svelte';
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Button from '#lib/components/ui/button/index.js';
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as CardHeading from '#lib/components/ui/card-heading/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Code from '#lib/components/ui/inputs/code/index.js';
	import { toast } from '#lib/components/ui/toast/index.js';
	import { FUNCTION_LIBS } from '#lib/functions/functions.js';
	import type { FunctionLanguage } from '#lib/functions/functions.js';
	import {
		deployFunction,
		getFunction,
		getFunctionTypings,
		getFunctionVersions
	} from '../functions.remote';
	import type { FunctionData } from '../types';
	import UploadCodeDialog from './upload-code-dialog.svelte';

	type Props = { fn: FunctionData };

	let { fn }: Props = $props();

	const dialogs = Dialog.getDialogs();
	const typings = $derived(await getFunctionTypings());

	// The editor starts from the code that runs; the page creates it again after a new version.
	let language = $state<FunctionLanguage>(untrack(() => fn.language ?? 'typescript'));
	let source = $state(untrack(() => fn.source));
	let failure = $state<string | null>(null);

	const changed = $derived(source !== fn.source || language !== (fn.language ?? 'typescript'));

	function errorMessage(error: unknown): string {
		const body = (error as { body?: { message?: unknown } } | null)?.body;

		if (typeof body?.message === 'string') {
			return body.message;
		}

		return error instanceof Error ? error.message : 'Something went wrong';
	}

	async function upload() {
		const result = await dialogs.open(UploadCodeDialog);

		if (result) {
			language = result.language;
			source = result.source;
			failure = null;
		}
	}

	function discard() {
		language = fn.language ?? 'typescript';
		source = fn.source;
		failure = null;
	}

	async function deploy() {
		failure = null;

		try {
			const compiled = language === 'typescript' ? await Code.compileTypeScript(source) : undefined;
			const version = await deployFunction({ id: fn.id, language, source, compiled });

			toast.success(`Deployed version ${version.number}`);

			await Promise.all([getFunction(fn.name).refresh(), getFunctionVersions(fn.id).refresh()]);
		} catch (error) {
			failure = errorMessage(error);
		}
	}
</script>

<Card.Root>
	<CardHeading.Root title="Code" titleId="function-code-title">
		{#snippet badges()}
			<Badge.Root variant="outline">
				{language === 'typescript' ? 'TypeScript' : 'JavaScript'}
			</Badge.Root>
			{#if changed}
				<Badge.Root variant="warning">Not deployed</Badge.Root>
			{/if}
		{/snippet}

		{#snippet description()}
			An ES module whose default export has a <code>fetch(request, env, ctx)</code> handler, like a
			Cloudflare Worker. Secrets are in <code>env</code>. <code>ctx.pouch</code> is the JS SDK
			acting as an admin, and <code>ctx.pouch.auth.me()</code> is the signed-in user.
		{/snippet}

		{#snippet actions()}
			<div class="flex flex-wrap gap-2">
				<Button.Root variant="secondary" onclick={upload}>
					<Icon.Root icon="lucide:upload" />
					Upload file
				</Button.Root>

				{#if changed}
					<Button.Root variant="ghost" onclick={discard}>Discard changes</Button.Root>
				{/if}

				<Button.Root disabled={!changed && fn.deployed} onclick={deploy}>
					<Icon.Root icon="lucide:rocket" />
					Deploy
				</Button.Root>
			</div>
		{/snippet}
	</CardHeading.Root>

	<Card.Content class="flex flex-col gap-3">
		{#if !fn.deployed && !changed}
			<Callout.Root variant="warning">
				<Callout.Icon><Icon.Root icon="lucide:circle-alert" /></Callout.Icon>
				<Callout.Body>
					<Callout.Description>
						This function isn't deployed yet. Deploy it to create its Worker on Cloudflare.
					</Callout.Description>
				</Callout.Body>
			</Callout.Root>
		{/if}

		{#if failure}
			<Callout.Root variant="error">
				<Callout.Icon><Icon.Root icon="lucide:circle-alert" /></Callout.Icon>
				<Callout.Body>
					<Callout.Title>Deploy failed</Callout.Title>
					<Callout.Description class="font-mono text-xs whitespace-pre-wrap">
						{failure}
					</Callout.Description>
				</Callout.Body>
			</Callout.Root>
		{/if}

		<!-- The editor's language is fixed once it is created, so a new language creates it again. -->
		{#key language}
			<Code.Root
				bind:value={source}
				{language}
				{typings}
				lib={FUNCTION_LIBS}
				aria-labelledby="function-code-title"
				class="h-[36rem]"
			/>
		{/key}
	</Card.Content>
</Card.Root>
