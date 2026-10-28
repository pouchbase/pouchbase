import { describe, expect, it } from 'vitest';

import { AUTH_TABLE_STATEMENTS, authFields, issuesByField } from './users-table';

describe('users table', () => {
	it('has the system fields of a user', () => {
		expect(authFields().map((field) => field.name)).toEqual([
			'email',
			'name',
			'avatar',
			'verified'
		]);
		expect(authFields().find((field) => field.name === 'email')?.unique).toBe(true);
	});

	it('keeps passwords and provider links in internal tables', () => {
		const sql = AUTH_TABLE_STATEMENTS.map((statement) => statement.sql).join('\n');

		expect(sql).toContain('"_passwords"');
		expect(sql).toContain('"_external_auths"');
		expect(
			AUTH_TABLE_STATEMENTS.every((statement) => statement.sql.includes('IF NOT EXISTS'))
		).toBe(true);
	});
});

describe('issuesByField', () => {
	it('keys messages by the first path segment, `form` without one', () => {
		expect(
			issuesByField([
				{ path: ['email'], message: 'Invalid' },
				{ path: [], message: 'Nope' }
			])
		).toEqual({ email: 'Invalid', form: 'Nope' });
	});
});
