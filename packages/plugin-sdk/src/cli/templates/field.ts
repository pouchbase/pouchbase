import type { PluginEntry } from './entries.js';

/** The `field` template: a color field type, checked and lowercased on the server. */

/** The `field` template: a color field type. */
export function colorFieldEntry(): PluginEntry {
	return {
		key: 'fields',
		id: 'color',
		value: 'color',
		imports: [`import color from './fields/color/field.js';`],
		files: {
			'fields/color/field.ts': `import { defineField } from '@pouchbasejs/plugin-sdk/server';

import Input from './input.svelte';
import Preview from './preview.svelte';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The color field type: a hex code in a TEXT column, checked and lowercased on the server. */
export default defineField({
	label: 'Color',
	description: 'A color as a hex code, e.g. #ff6600.',
	column: 'TEXT',
	input: Input,
	preview: Preview,
	// An Iconify name (https://icon-sets.iconify.design), or an imported .svg file.
	icon: 'lucide:palette',
	validate(value) {
		return typeof value === 'string' && HEX_COLOR.test(value)
			? { valid: true }
			: { valid: false, message: 'Enter a color, e.g. #ff6600' };
	},
	serialize(value) {
		return String(value).toLowerCase();
	}
});
`,
			'fields/color/input.svelte': `<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';

	let { name, value, required, disabled, id, errorId }: FieldInputProps<string> = $props();
</script>

<input
	type="color"
	{id}
	{name}
	value={value ?? '#000000'}
	{required}
	{disabled}
	aria-describedby={errorId}
/>
`,
			'fields/color/preview.svelte': `<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	let { value }: FieldPreviewProps<string> = $props();
</script>

<!-- Tailwind classes work in every component, with the dashboard's design tokens. -->
<span class="inline-flex items-center gap-1.5">
	<span class="size-3 rounded-full inset-ring inset-ring-black/10" style:background={value}></span>
	{value}
</span>
`
		}
	};
}

/** The test of the `field` template: the color field type's server code. */
export const COLOR_TEST = `import type { FieldTypeHandler } from '@pouchbasejs/plugin-sdk/server';

import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import plugin from '../plugin.js';

// Called the way Pouchbase calls it: with the field's options and the plugin context.
const color: FieldTypeHandler = plugin.fields.color;

describe('the color field type', () => {
	const { ctx } = fakeContext();

	it('accepts hex colors and stores them lowercased', async () => {
		expect(await color.validate?.('#FF6600', {}, ctx)).toEqual({ valid: true });
		expect(await color.serialize?.('#FF6600', ctx)).toBe('#ff6600');
	});

	it('refuses anything else', async () => {
		expect(await color.validate?.('orange', {}, ctx)).toEqual({
			valid: false,
			message: 'Enter a color, e.g. #ff6600'
		});
	});
});
`;
