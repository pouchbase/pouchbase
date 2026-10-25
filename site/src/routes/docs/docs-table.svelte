<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import * as Table from '#lib/components/ui/table/index.js';

	interface Props {
		/** The column headings. */
		head: string[];
		/** The rows, a text per column; the first one must be unique. */
		rows: string[][];
		/**
		 * How many columns, from the left, hold code. With `0`, the first column is a label in bold
		 * instead.
		 */
		code?: number;
	}

	let { head, rows, code = 1 }: Props = $props();
</script>

<!-- A reference table of the docs: a name, code or value per row, then what it means. -->
<Table.Root>
	<Table.Header>
		<Table.Row>
			{#each head as heading (heading)}
				<Table.Head>{heading}</Table.Head>
			{/each}
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each rows as row (row[0])}
			<Table.Row>
				{#each row as cell, index (index)}
					{#if index < code}
						<Table.Cell><Code.Root class="whitespace-pre">{cell}</Code.Root></Table.Cell>
					{:else if index === 0}
						<Table.Cell class="font-medium whitespace-nowrap text-zinc-900">{cell}</Table.Cell>
					{:else}
						<Table.Cell>{cell}</Table.Cell>
					{/if}
				{/each}
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
