import { describe, expect, it } from 'vitest';

import { encode, identifier, insertStatement, literal, splitStatements } from './sql';

function split(text: string, final = true) {
	const bytes = new TextEncoder().encode(text);
	const result = splitStatements(bytes, final);

	return { ...result, sql: result.statements.map((statement) => statement.sql) };
}

describe('splitStatements', () => {
	it('splits on semicolons and trims', () => {
		expect(split('CREATE TABLE a (id);\nINSERT INTO a VALUES (1);\n').sql).toEqual([
			'CREATE TABLE a (id);',
			'INSERT INTO a VALUES (1);'
		]);
	});

	it('ignores semicolons inside quotes, identifiers and comments', () => {
		const text = [
			`INSERT INTO a VALUES ('x;y', 'it''s', "q;", \`b;\`, [c;d]);`,
			`-- a comment; with a semicolon`,
			`/* block; comment */ INSERT INTO a VALUES (2);`
		].join('\n');

		// Comments stay with the statement after them; SQLite skips them.
		expect(split(text).sql).toEqual([
			`INSERT INTO a VALUES ('x;y', 'it''s', "q;", \`b;\`, [c;d]);`,
			`-- a comment; with a semicolon\n/* block; comment */ INSERT INTO a VALUES (2);`
		]);
	});

	it('keeps a trigger body as one statement', () => {
		const trigger = `CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE a SET id = 1; DELETE FROM b; END;`;

		expect(split(`${trigger}\nSELECT 1;`).sql).toEqual([trigger, 'SELECT 1;']);
	});

	it('reports how many bytes the complete statements span', () => {
		const { statements, consumed } = split('SELECT 1;\nSELECT 2', false);

		expect(statements).toEqual([{ sql: 'SELECT 1;', end: 9 }]);
		expect(consumed).toBe(9);
	});

	it('takes the rest as a statement at the end of the dump', () => {
		expect(split('SELECT 1;\nSELECT 2', true).sql).toEqual(['SELECT 1;', 'SELECT 2']);
		expect(split('SELECT 1;\n-- done\n', true).sql).toEqual(['SELECT 1;']);
		expect(split('SELECT 1;\n-- done\n', true).consumed).toBe(18);
	});

	it('works on multi-byte text', () => {
		const { statements } = split(`INSERT INTO a VALUES ('héllo — wörld');`);

		expect(statements[0].sql).toBe(`INSERT INTO a VALUES ('héllo — wörld');`);
		expect(statements[0].end).toBe(new TextEncoder().encode(statements[0].sql).length);
	});
});

describe('literal, identifier and insertStatement', () => {
	it('quotes values and names for a dump', () => {
		expect(literal(null)).toBe('NULL');
		expect(literal(undefined)).toBe('NULL');
		expect(literal(3)).toBe('3');
		expect(literal(true)).toBe('1');
		expect(literal("it's")).toBe("'it''s'");
		expect(identifier('a"b')).toBe('"a""b"');
	});

	it('writes an insert, guarded by a condition when given', () => {
		expect(insertStatement('settings', { key: 'k', value: null })).toBe(
			`INSERT INTO "settings" ("key", "value") VALUES ('k', NULL);`
		);
		expect(insertStatement('sessions', { id: 1 }, 'WHERE EXISTS (SELECT 1)')).toBe(
			`INSERT INTO "sessions" ("id") SELECT 1 WHERE EXISTS (SELECT 1);`
		);
	});
});

describe('encode', () => {
	it('joins strings and bytes into one array', () => {
		const bytes = encode('a', new Uint8Array([0x62]), 'c');

		expect(new TextDecoder().decode(bytes)).toBe('abc');
	});
});
