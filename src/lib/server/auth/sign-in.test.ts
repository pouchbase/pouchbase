import { describe, expect, it } from 'vitest';

import { decideSignIn, normalizeEmail } from './sign-in';

describe('decideSignIn', () => {
	it('signs a linked user in again, whatever the email says', () => {
		expect(
			decideSignIn(
				{ email: 'a@example.com', emailVerified: false },
				{ linkedUserId: 'u1', emailOwnerId: 'u2' }
			)
		).toEqual({ action: 'sign-in', userId: 'u1' });
	});

	it('creates a user when nobody has the address', () => {
		expect(
			decideSignIn(
				{ email: 'a@example.com', emailVerified: true },
				{ linkedUserId: null, emailOwnerId: null }
			)
		).toEqual({ action: 'create' });
		expect(
			decideSignIn(
				{ email: null, emailVerified: false },
				{ linkedUserId: null, emailOwnerId: null }
			)
		).toEqual({ action: 'create' });
	});

	it('links to the owner of a verified address', () => {
		expect(
			decideSignIn(
				{ email: 'a@example.com', emailVerified: true },
				{ linkedUserId: null, emailOwnerId: 'u2' }
			)
		).toEqual({ action: 'link', userId: 'u2' });
	});

	it('refuses an unverified address that belongs to someone', () => {
		expect(
			decideSignIn(
				{ email: 'a@example.com', emailVerified: false },
				{ linkedUserId: null, emailOwnerId: 'u2' }
			)
		).toEqual({ action: 'conflict' });
	});
});

describe('normalizeEmail', () => {
	it('lowercases and trims', () => {
		expect(normalizeEmail('  A@Example.com ')).toBe('a@example.com');
	});

	it('turns nothing into null', () => {
		expect(normalizeEmail(undefined)).toBeNull();
		expect(normalizeEmail('')).toBeNull();
	});
});
