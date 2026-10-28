<script lang="ts">
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { EXAMPLES } from './api-rules.js';
</script>

<Collapsible.Root>
	<Collapsible.Trigger>How custom rules work</Collapsible.Trigger>
	<Collapsible.Content class="flex flex-col gap-4 pt-3 text-sm text-zinc-600">
		<p>
			A custom rule is a condition: a request is only allowed for records that match it. Combine
			comparisons with <code class="font-mono">&amp;&amp;</code> (or
			<code class="font-mono">AND</code>) and <code class="font-mono">||</code> (or
			<code class="font-mono">OR</code>), group them with parentheses, and start a comment with
			<code class="font-mono">#</code>. The editor suggests fields and functions as you type.
		</p>

		<Table.Root>
			<Table.Body>
				<Table.Row>
					<Table.Cell class="font-mono whitespace-nowrap">title, author, …</Table.Cell>
					<Table.Cell>Fields of the record</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell class="font-mono whitespace-nowrap">$user.id</Table.Cell>
					<Table.Cell>
						A field of the signed-in user, from <span class="font-mono">users</span>; empty when
						signed out
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell class="font-mono whitespace-nowrap">$input.title</Table.Cell>
					<Table.Cell>A submitted value, in create and update rules</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell class="font-mono whitespace-nowrap">== != &gt; &gt;= &lt; &lt;=</Table.Cell>
					<Table.Cell
						>Compare; <span class="font-mono">== null</span> also matches empty values</Table.Cell
					>
				</Table.Row>
				<Table.Row>
					<Table.Cell class="font-mono whitespace-nowrap">contains(title, "x")</Table.Cell>
					<Table.Cell
						>Text functions: also <span class="font-mono">starts_with</span>,
						<span class="font-mono">ends_with</span>, <span class="font-mono">like</span>,
						<span class="font-mono">lower</span>, <span class="font-mono">length</span>, …
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell class="font-mono whitespace-nowrap">now(), today()</Table.Cell>
					<Table.Cell
						>Date functions: also <span class="font-mono">date_add</span>,
						<span class="font-mono">start_of</span>, <span class="font-mono">year</span>,
						<span class="font-mono">weekday</span>, … (UTC)
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell class="font-mono whitespace-nowrap">! or NOT</Table.Cell>
					<Table.Cell>The opposite of a condition</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell class="font-mono whitespace-nowrap">any(editors) == …</Table.Cell>
					<Table.Cell>Any item of a multiple relation or list matches</Table.Cell>
				</Table.Row>
			</Table.Body>
		</Table.Root>

		<div class="flex flex-col gap-2">
			<h4 class="font-medium text-zinc-900">Examples</h4>
			<Table.Root>
				<Table.Body>
					{#each EXAMPLES as [label, example] (example)}
						<Table.Row>
							<Table.Cell>{label}</Table.Cell>
							<Table.Cell class="font-mono">{example}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</Collapsible.Content>
</Collapsible.Root>
