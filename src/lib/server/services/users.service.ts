import type { ServiceError } from './base.service';
import type { ResultAsync } from 'neverthrow';

import { asc, eq } from 'drizzle-orm';

import { hashPassword } from '../crypto';
import { users } from '../db';
import { Service } from './base.service';

export type User = typeof users.$inferSelect;

/** A user without the password hash, safe to send to the browser. */
export type UserSummary = Omit<User, 'passwordHash'>;

export type CreateUserInput = {
	email: string;
	password: string;
};

type HasUsersFailed = ServiceError<3000, 'HAS_USERS_FAILED'>;
type FindUserFailed = ServiceError<3001, 'FIND_USER_FAILED'>;
type CreateUserFailed = ServiceError<3002, 'CREATE_USER_FAILED'>;
type EmailTaken = ServiceError<3004, 'EMAIL_TAKEN'>;
type ListUsersFailed = ServiceError<3005, 'LIST_USERS_FAILED'>;

/** SQLite (D1 or a local file) reports `no such table` when the migrations haven't run yet. */
function isMissingTable(error: unknown) {
	const cause = error instanceof Error && error.cause ? error.cause : error;

	return cause instanceof Error && cause.message.includes('no such table');
}

/** The admins of the dashboard (the `users` table of the system database, not app users). */
export class UsersService extends Service {
	/** Whether at least one user exists. A database without tables counts as "no users". */
	hasAny(): ResultAsync<boolean, HasUsersFailed> {
		return this.run(
			async () => {
				try {
					const [user] = await this.db.select({ id: users.id }).from(users).limit(1);

					return user !== undefined;
				} catch (error) {
					if (isMissingTable(error)) {
						return false;
					}

					throw error;
				}
			},
			(error) => this.error(3000, 'HAS_USERS_FAILED', error)
		);
	}

	/** Finds a user by email address. */
	findByEmail(email: string): ResultAsync<User | null, FindUserFailed> {
		return this.run(
			async () => {
				const [user] = await this.db.select().from(users).where(eq(users.email, email));

				return user ?? null;
			},
			(error) => this.error(3001, 'FIND_USER_FAILED', error)
		);
	}

	/** All admin users, oldest first. */
	list(): ResultAsync<UserSummary[], ListUsersFailed> {
		return this.run(
			() =>
				this.db
					.select({ id: users.id, email: users.email, createdAt: users.createdAt })
					.from(users)
					.orderBy(asc(users.createdAt)),
			(error) => this.error(3005, 'LIST_USERS_FAILED', error)
		);
	}

	/** Creates a user; the email address must not be in use yet. */
	create(
		input: CreateUserInput
	): ResultAsync<User, FindUserFailed | CreateUserFailed | EmailTaken> {
		return this.run(
			async () => {
				if (await this.must(this.findByEmail(input.email))) {
					this.fail(3004, 'EMAIL_TAKEN');
				}

				const [user] = await this.db
					.insert(users)
					.values({ email: input.email, passwordHash: await hashPassword(input.password) })
					.returning();

				return user;
			},
			(error) => this.error(3002, 'CREATE_USER_FAILED', error)
		);
	}
}
