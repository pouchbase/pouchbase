<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';

	let { text, label = 'Copy' }: { text: string; label?: string } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		await navigator.clipboard.writeText(text);
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 1500);
	}
</script>

<!-- lucide:copy and lucide:check are bundled with the dashboard; other names are fetched from the
	Iconify API when shown, so prefer Icon.Root's src for icons of your own. -->
<Button.Root variant="ghost" size="icon-sm" onclick={copy} aria-label={copied ? 'Copied' : label}>
	{#if copied}
		<Icon.Root icon="lucide:check" class="text-emerald-600" />
	{:else}
		<Icon.Root icon="lucide:copy" />
	{/if}
</Button.Root>
