import type { UiComponent } from '#lib/ui-components.js';
import { classProp } from '#lib/ui-props.js';

export default {
	slug: 'icon',
	category: 'display',
	name: 'Icon',
	title: 'Icon',
	entry: 'icon',
	description: 'An Iconify icon, or an SVG file drawn in the text color, at the size of the text.',
	about: [
		'`icon` is an Iconify name such as `lucide:plus`. In an app, the `iconify` Vite plugin bundles the icons it finds in the sources, so the name must appear literally (see [setup](/docs/ui#setup)).',
		"`src` is the URL of an SVG, such as a `data:` URL or a plugin's icon, drawn as a mask in `currentColor` so only its shape counts; it wins over `icon`. In a plugin, prefer `src`: names the dashboard doesn't bundle are fetched from the Iconify API.",
		'Icons are `1em` square in the text color, and hidden from assistive technology unless they have a `label`.'
	],
	parts: [
		{
			name: 'Root',
			description: 'An `<svg>`.',
			props: [
				{
					name: 'icon',
					type: 'string',
					description: 'Iconify name, e.g. `lucide:plus`; shown when there is no `src`.'
				},
				{
					name: 'src',
					type: 'string | null',
					description: 'URL of an SVG image, drawn in the text color.'
				},
				{
					name: 'label',
					type: 'string',
					description: 'Accessible label; without one the icon is decorative.'
				},
				classProp
			]
		}
	],
	examples: [
		{
			id: 'basic',
			title: 'Size and color',
			description: 'Size icons with `size-*` and color them with `text-*`.'
		},
		{
			id: 'src',
			title: 'An SVG file',
			description: 'A `data:` URL here; a plugin can also use the URL of one of its icons.'
		}
	]
} satisfies UiComponent;
