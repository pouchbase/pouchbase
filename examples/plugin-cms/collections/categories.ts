import { defineCollection } from '@pouchbasejs/plugin-sdk/server';

/** `cms_categories`: the categories posts can be filed under; anyone can read them. */
export default defineCollection({
	fields: [
		{ name: 'name', type: 'text', required: true },
		{ name: 'slug', type: 'text', required: true, unique: true }
	],
	rules: { list: '', view: '' }
});
