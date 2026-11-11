import type { Collection } from '#lib/server/services/collections.service.js';
import type { Field } from '#lib/server/services/fields.service.js';

import { describe, expect, it } from 'vitest';

import { declarations } from './declarations';

function collection(id: string, name: string): Collection {
	return { id, name, system: false, settings: {}, pluginId: null, createdAt: new Date(0) };
}

function field(collectionId: string, name: string, patch: Partial<Field> = {}): Field {
	return {
		id: `${collectionId}-${name}`,
		collectionId,
		name,
		type: 'text',
		required: false,
		unique: false,
		hidden: false,
		defaultValue: null,
		options: {},
		system: false,
		position: 0,
		createdAt: new Date(0),
		...patch
	};
}

const posts = collection('c1', 'blog_posts');
const users = collection('c2', 'users');
const none = { installed: [], deserializes: new Set<string>() };

describe('declarations', () => {
	it('declares a record and a create type per collection, and the schema', () => {
		const code = declarations(
			[posts, users],
			[
				field('c1', 'id', { type: 'id' }),
				field('c1', 'title', { required: true }),
				field('c1', 'author', { type: 'relation', options: { collectionId: 'c2' } }),
				field('c1', 'tags', { type: 'list', options: { values: ['a', 'b'], multiple: true } }),
				field('c1', 'slug', { type: 'computed', options: { transform: 'slug', source: 'title' } }),
				field('c1', 'raw', { type: 'blob' }),
				field('c2', 'id', { type: 'id' }),
				field('c2', 'email', { type: 'email', required: true }),
				field('c2', 'secret', { hidden: true })
			],
			none,
			[],
			[]
		);

		expect(code).toContain('export interface BlogPostsRecord {');
		expect(code).toContain('\tid: string;');
		expect(code).toContain('\ttitle: string;');
		expect(code).toContain('\tauthor: string | null;');
		expect(code).toContain('	tags: ("a" | "b")[];');
		expect(code).toContain('\tslug: string | null;');
		// Blobs are not part of the API.
		expect(code).not.toContain('raw');
		// Hidden fields are optional, and only admins get them.
		expect(code).toContain('\tsecret?: string | null;');
		expect(code).toContain('Hidden: only admins and API keys read and write it.');

		expect(code).toContain('export interface BlogPostsCreate {');
		// Filled-in and computed fields are not sent.
		expect(code).not.toMatch(/BlogPostsCreate \{[^}]*\bid\b/);
		expect(code).not.toMatch(/BlogPostsCreate \{[^}]*\bslug\b/);
		expect(code).toContain('\ttitle: string;');

		expect(code).toContain(
			'\tblog_posts: { $record: BlogPostsRecord; $create: BlogPostsCreate; $relations: { author: "users" } };'
		);
		expect(code).toContain('\tusers: { $record: UsersRecord; $create: UsersCreate };');
		expect(code).toContain('export interface Collections {\n\tblog_posts: BlogPostsRecord;');
	});

	it('numbers interface names that clash', () => {
		const code = declarations(
			[collection('a', 'blog_posts'), collection('b', 'blog__posts')],
			[],
			none,
			[],
			[]
		);

		expect(code).toContain('export interface BlogPostsRecord {');
		expect(code).toContain('export interface BlogPosts2Record {');
	});

	it('declares the variables of the email templates', () => {
		const code = declarations(
			[],
			[],
			none,
			[
				{
					name: 'welcome-email',
					description: 'Sent after sign-up.',
					variables: [
						{ name: 'name', required: true },
						{ name: 'promo', required: false }
					]
				},
				{ name: 'plain', description: '', variables: [] },
				{ name: 'broken', description: '', variables: null }
			],
			[]
		);

		expect(code).toContain('\t"welcome-email": {');
		expect(code).toContain('\t\tname: unknown;');
		expect(code).toContain('\t\tpromo?: unknown;');
		expect(code).toContain('\tplain: Record<string, never>;');
		expect(code).toContain('\tbroken: Record<string, unknown>;');
	});

	it('declares the names of the functions', () => {
		const code = declarations(
			[],
			[],
			none,
			[],
			[
				{ name: 'send-invoice', description: 'Mails an invoice.', requireAuth: true },
				{ name: 'hello', description: '', requireAuth: false }
			]
		);

		expect(code).toContain(
			'export interface Functions {\n\t/** Mails an invoice. Requires sign-in. */\n\t"send-invoice": unknown;\n\thello: unknown;\n}'
		);
	});

	it('closes JSDoc comments safely', () => {
		const code = declarations(
			[posts],
			[field('c1', 'x')],
			none,
			[{ name: 'tricky', description: 'ends with */ here', variables: [] }],
			[]
		);

		expect(code).toContain('/** ends with * / here */');
	});
});
