<script lang="ts">
	import * as Button from '#lib/components/ui/button/index.js';
	import * as DataGrid from '#lib/components/ui/data-grid/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';

	type Props = {
		total: number;
		/** The current page, starting at 1. */
		page: number;
		perPage: number;
		/** Goes to another page; `null` is the first page (no `page` in the URL). */
		onPage: (page: string | null) => void;
	};

	let { total, page, perPage, onPage }: Props = $props();

	const pageCount = $derived(Math.max(1, Math.ceil(total / perPage)));
	const firstRow = $derived(total ? (page - 1) * perPage + 1 : 0);
	const lastRow = $derived(Math.min(page * perPage, total));
</script>

<DataGrid.Footer>
	<span>
		{#if total}
			{firstRow}–{lastRow} of {total}
			{total === 1 ? 'record' : 'records'}
		{:else}
			0 records
		{/if}
	</span>

	<div class="flex items-center gap-2">
		<span>Page {page} of {pageCount}</span>
		<Button.Root
			variant="secondary"
			size="icon"
			aria-label="Previous page"
			disabled={page <= 1}
			onclick={() => onPage(page > 2 ? String(page - 1) : null)}
		>
			<Icon.Root icon="lucide:chevron-left" />
		</Button.Root>
		<Button.Root
			variant="secondary"
			size="icon"
			aria-label="Next page"
			disabled={page >= pageCount}
			onclick={() => onPage(String(page + 1))}
		>
			<Icon.Root icon="lucide:chevron-right" />
		</Button.Root>
	</div>
</DataGrid.Footer>
