import type { ServiceError } from './base.service';
import type { User } from './users.service';
import type { ResultAsync } from 'neverthrow';

import { eq } from 'drizzle-orm';
import { okAsync } from 'neverthrow';

import { generateToken, hashToken, verifyPassword } from '../crypto';
import { sessions, users } from '../db';
import { Service } from './base.service';

export type SessionUser = Pick<User, 'id' | 'email'>;

export type SessionsError =
	| ServiceError<3001, 'FIND_USER_FAILED'>
	| ServiceError<4000, 'SESSIONS_FAILED'>
	| ServiceError<4003, 'INVALID_CREDENTIALS'>;

export const SESSION_COOKIE = 'session';

const DAY = 24 * 60 * 60 * 1000;
const SESSION_TTL = 30 * DAY;

/**
 * Validated sessions are trusted for this long without asking the database again, per isolate.
 * Every request validates the session first, so this saves a round-trip on most of them; a logout
 * on another isolate takes at most this long to apply here.
 */
const CACHE_TTL = 30_000;
const CACHE_LIMIT = 1000;

/** Validated sessions by token hash. */
const cache = new Map<string, { user: SessionUser; expiresAt: number; validatedAt: number }>();

/** Full: start over; entries are only good for `CACHE_TTL` anyway (checked on read). */
function cacheSession(id: string, user: SessionUser, expiresAt: number) {
	if (cache.size >= CACHE_LIMIT) {
		cache.clear();
	}

	cache.set(id, { user, expiresAt, validatedAt: Date.now() });
}

/** The sessions of admins: a cookie with a random token, hashed in the `sessions` table. */
export class SessionsService extends Service {
	/** Creates a session for the user and sets the session cookie. */
	create(userId: string): ResultAsync<void, SessionsError> {
		return this.run(
			async () => {
				const token = generateToken();
				const expiresAt = new Date(Date.now() + SESSION_TTL);

				await this.db.insert(sessions).values({ id: await hashToken(token), userId, expiresAt });
				this.setCookie(token, expiresAt);
			},
			(error) => this.error(4000, 'SESSIONS_FAILED', error)
		);
	}

	/**
	 * Returns the user for a session token, or `null` when the session is unknown or expired.
	 * Sessions are extended once they are past their halfway point. Valid sessions are cached
	 * briefly (`CACHE_TTL`).
	 */
	validate(token: string): ResultAsync<SessionUser | null, SessionsError> {
		return this.run(
			async () => {
				const id = await hashToken(token);
				const cached = cache.get(id);

				if (cached) {
					const now = Date.now();

					if (now - cached.validatedAt < CACHE_TTL && cached.expiresAt > now) {
						return cached.user;
					}

					cache.delete(id);
				}

				const [row] = await this.db
					.select({
						user: { id: users.id, email: users.email },
						expiresAt: sessions.expiresAt
					})
					.from(sessions)
					.innerJoin(users, eq(sessions.userId, users.id))
					.where(eq(sessions.id, id));

				if (!row) {
					return null;
				}

				const remaining = row.expiresAt.getTime() - Date.now();

				if (remaining <= 0) {
					await this.db.delete(sessions).where(eq(sessions.id, id));

					return null;
				}

				let expiresAt = row.expiresAt;

				if (remaining < SESSION_TTL / 2) {
					expiresAt = new Date(Date.now() + SESSION_TTL);
					await this.db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
					this.setCookie(token, expiresAt);
				}

				cacheSession(id, row.user, expiresAt.getTime());

				return row.user;
			},
			(error) => this.error(4000, 'SESSIONS_FAILED', error)
		);
	}

	/** Deletes the current session and its cookie. */
	invalidate(): ResultAsync<void, SessionsError> {
		const token = this.ctx.cookies.get(SESSION_COOKIE);
		this.ctx.cookies.delete(SESSION_COOKIE, { path: '/' });

		if (!token) {
			return okAsync(undefined);
		}

		return this.run(
			async () => {
				const id = await hashToken(token);

				cache.delete(id);
				await this.db.delete(sessions).where(eq(sessions.id, id));
			},
			(error) => this.error(4000, 'SESSIONS_FAILED', error)
		);
	}

	/** Checks the credentials (email and password) and starts a session. */
	login(email: string, password: string): ResultAsync<SessionUser, SessionsError> {
		return this.run(
			async () => {
				const user = await this.must(this.services.users().findByEmail(email));

				if (!user || !(await verifyPassword(password, user.passwordHash))) {
					this.fail(4003, 'INVALID_CREDENTIALS');
				}

				await this.must(this.create(user.id));

				return { id: user.id, email: user.email };
			},
			(error) => this.error(4000, 'SESSIONS_FAILED', error)
		);
	}

	private setCookie(token: string, expiresAt: Date) {
		this.ctx.cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			expires: expiresAt
		});
	}
}
