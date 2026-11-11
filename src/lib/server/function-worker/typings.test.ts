import type { Collection } from '#lib/server/services/collections.service.js';
import type { Field } from '#lib/server/services/fields.service.js';

import { dirname, join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { declarations } from '#lib/fields/declarations.js';
import { FUNCTION_LIBS, functionTemplate } from '#lib/functions/functions.js';

import { functionTypings } from './typings';

const TYPINGS_FILE = '/typings.d.ts';

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

const TYPINGS = functionTypings(
	declarations(
		[collection('c1', 'posts'), collection('c2', 'users')],
		[
			field('c1', 'id', { type: 'id' }),
			field('c1', 'title', { required: true }),
			field('c2', 'id', { type: 'id' }),
			field('c2', 'email', { type: 'email', required: true })
		],
		{ installed: [], deserializes: new Set<string>() },
		[],
		[{ name: 'hello', description: '', requireAuth: false }]
	)
);

/** The type errors of `source` with the editor's typings and libraries. */
function typeErrors(source: string, fileName: string) {
	const options: ts.CompilerOptions = {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		lib: FUNCTION_LIBS.map((lib) => `lib.${lib}.d.ts`),
		types: [],
		strict: true,
		allowJs: true,
		checkJs: true,
		noEmit: true
	};
	const host = ts.createCompilerHost(options);
	const files = new Map([
		[fileName, source],
		[TYPINGS_FILE, TYPINGS]
	]);
	const { getSourceFile, fileExists, readFile } = host;

	host.getDefaultLibLocation = () => dirname(ts.getDefaultLibFilePath(options));
	host.getDefaultLibFileName = (settings) =>
		join(host.getDefaultLibLocation!(), ts.getDefaultLibFileName(settings));
	host.fileExists = (name) => files.has(name) || fileExists(name);
	host.readFile = (name) => files.get(name) ?? readFile(name);
	host.getSourceFile = (name, version) => {
		const text = files.get(name);

		return text === undefined
			? getSourceFile(name, version)
			: ts.createSourceFile(name, text, version);
	};

	const program = ts.createProgram([fileName, TYPINGS_FILE], options, host);

	return ts
		.getPreEmitDiagnostics(program)
		.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'));
}

describe('the typings of the functions editor', () => {
	it('cover the TypeScript starter code', () => {
		expect(typeErrors(functionTemplate('typescript'), '/function.ts')).toEqual([]);
	});

	it('cover the JavaScript starter code', () => {
		expect(typeErrors(functionTemplate('javascript'), '/function.js')).toEqual([]);
	});

	it('type the collections of the instance on ctx', () => {
		const source = `export default {
	async fetch(request: Request, env: object, ctx: ExecutionContext) {
		const { items } = await ctx.pouch.db.posts.findMany();
		const titles: string[] = items.map((post) => post.title);
		const user = await ctx.pouch.db.users.find('id');

		return Response.json({ titles, email: user?.email, id: ctx.pouch.session.userId });
	}
};`;

		expect(typeErrors(source, '/function.ts')).toEqual([]);
	});

	it('type the names of the functions of the instance on ctx', () => {
		const source = `export default {
	async fetch(request: Request, env: object, ctx: ExecutionContext) {
		await ctx.pouch.functions.invoke('hello');
		await ctx.pouch.functions.invoke('helo');

		return new Response();
	}
};`;
		const errors = typeErrors(source, '/function.ts');

		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('helo');
	});

	it('reject fields and methods that do not exist', () => {
		const source = `export default {
	async fetch(request: Request, env: object, ctx: ExecutionContext) {
		const { items } = await ctx.pouch.db.posts.findMany();

		ctx.pouch.nothing();

		return Response.json(items[0].missing);
	}
};`;
		const errors = typeErrors(source, '/function.ts').join('\n');

		expect(errors).toContain('nothing');
		expect(errors).toContain('missing');
	});
});
