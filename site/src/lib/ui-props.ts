import type { UiProp } from './ui-components.js';

// Props shared by the parts of several components, in their `meta.ts`.

export const classProp: UiProp = {
	name: 'class',
	type: 'string',
	description: 'Classes merged with the default ones.'
};

export const ariaLabels: UiProp[] = [
	{
		name: 'aria-label',
		type: 'string',
		description: 'Names it for assistive technology when there is no visible label.'
	},
	{ name: 'aria-labelledby', type: 'string', description: 'The id of a visible label.' }
];
