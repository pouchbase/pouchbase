import type { CreateFieldInput } from '../services/fields.service';

/**
 * What the built-in `users` collection comes with: its system fields (they can't be renamed or
 * deleted) and the internal tables next to it. Those are prefixed with `_` (collection names
 * can't start with one), so they never show up in the grid or the API: password hashes and the
 * links to provider accounts live outside the users table.
 */

/** `avatar` is a file field: an image in the built-in `files` collection. */
export function authFields(): CreateFieldInput[] {
	return [
		{ name: 'email', type: 'email', required: false, unique: true, options: {} },
		{ name: 'name', type: 'text', required: false, unique: false, options: {} },
		{
			name: 'avatar',
			type: 'file',
			required: false,
			unique: false,
			options: { accept: ['image/*'] }
		},
		{
			name: 'verified',
			type: 'boolean',
			required: false,
			unique: false,
			defaultValue: 'false',
			options: {}
		}
	];
}

/** One batch, so the tables exist after a single round-trip. */
export const AUTH_TABLE_STATEMENTS = [
	{
		sql: `CREATE TABLE IF NOT EXISTS "_external_auths" ("id" TEXT PRIMARY KEY NOT NULL, "user_id" TEXT NOT NULL, "provider" TEXT NOT NULL, "provider_id" TEXT NOT NULL, "created_at" INTEGER NOT NULL)`
	},
	{
		sql: `CREATE UNIQUE INDEX IF NOT EXISTS "_external_auths_provider" ON "_external_auths" ("provider", "provider_id")`
	},
	{
		sql: `CREATE INDEX IF NOT EXISTS "_external_auths_user" ON "_external_auths" ("user_id")`
	},
	{
		sql: `CREATE TABLE IF NOT EXISTS "_passwords" ("user_id" TEXT PRIMARY KEY NOT NULL, "hash" TEXT NOT NULL, "updated_at" INTEGER NOT NULL)`
	}
];

/** Zod issues as `INVALID_INPUT` reports them: one message per input field. */
export function issuesByField(
	issues: { path: PropertyKey[]; message: string }[]
): Record<string, string> {
	return Object.fromEntries(
		issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message])
	);
}
