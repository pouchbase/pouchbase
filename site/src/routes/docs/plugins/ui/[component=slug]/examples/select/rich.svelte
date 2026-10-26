<script lang="ts">
	import * as Select from '@pouchbasejs/ui/inputs/select';

	const types: Select.Item[] = [
		{ value: 'text', label: 'Text', icon: 'lucide:type', group: 'Basic' },
		{ value: 'number', label: 'Number', icon: 'lucide:hash', group: 'Basic' },
		{ value: 'bool', label: 'Boolean', icon: 'lucide:toggle-left', group: 'Basic' },
		{
			value: 'file',
			label: 'File',
			description: 'Images, documents and other uploads',
			icon: 'lucide:paperclip',
			group: 'Media'
		},
		{
			value: 'cover',
			label: 'Cover',
			description: 'An image with a preview',
			image: '/docs/plugins/ui/landscape.svg',
			icon: 'lucide:image',
			group: 'Media'
		},
		{ value: 'relation', label: 'Relation', icon: 'lucide:link', group: 'Advanced', disabled: true }
	];

	let type = $state('text');
</script>

<div class="max-w-xs">
	<Select.Root items={types} bind:value={type} aria-label="Field type" />
</div>
