<script lang="ts">
	import * as Badge from '@pouchbasejs/ui/badge';
	import * as Table from '@pouchbasejs/ui/table';

	const posts = [
		{ id: 'k3x9a2', title: 'Hello, world', status: 'Published', views: 1204 },
		{ id: 'p0d7c1', title: 'Realtime in five minutes', status: 'Published', views: 860 },
		{ id: 'z8m2q4', title: 'Plugins: a first look', status: 'Draft', views: 0 }
	];
</script>

<Table.Root>
	<Table.Header>
		<Table.Row>
			<Table.Head>Id</Table.Head>
			<Table.Head>Title</Table.Head>
			<Table.Head>Status</Table.Head>
			<Table.Head class="text-right">Views</Table.Head>
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each posts as post (post.id)}
			<Table.Row>
				<Table.Cell class="font-mono text-zinc-500">{post.id}</Table.Cell>
				<Table.Cell>{post.title}</Table.Cell>
				<Table.Cell>
					<Badge.Root variant={post.status === 'Published' ? 'success' : 'neutral'}>
						{post.status}
					</Badge.Root>
				</Table.Cell>
				<Table.Cell class="text-right tabular-nums">{post.views.toLocaleString('en')}</Table.Cell>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
