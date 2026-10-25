<script lang="ts">
	import * as Button from '@pouchbasejs/ui/button';
	import * as Icon from '@pouchbasejs/ui/icon';
	import * as Tile from '@pouchbasejs/ui/tile';
</script>

<Tile.Grid>
	<Tile.Root>
		<Tile.Header>
			<Tile.Icon><Icon.Root icon="lucide:database" /></Tile.Icon>
			<Tile.Title>Database</Tile.Title>
		</Tile.Header>
		<Tile.Value>48.2 MB</Tile.Value>
		<Tile.Description>12 collections, 9,140 records</Tile.Description>
	</Tile.Root>

	<Tile.Root>
		<Tile.Header>
			<Tile.Icon><Icon.Root icon="lucide:hard-drive" /></Tile.Icon>
			<Tile.Title>Files</Tile.Title>
		</Tile.Header>
		<Tile.Value>1.2 GB</Tile.Value>
		<Tile.Description>3,512 files</Tile.Description>
		<Tile.Footer>
			<Button.Root variant="secondary">Browse</Button.Root>
		</Tile.Footer>
	</Tile.Root>
</Tile.Grid>
