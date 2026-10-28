import { describe, expect, it } from 'vitest';

import {
	signPurposeToken,
	signUserToken,
	tokenKey,
	verifyPurposeToken,
	verifyUserToken
} from './tokens';

const key = tokenKey('a-fixed-secret-for-tests');
const otherKey = tokenKey('another-secret');

describe('user tokens', () => {
	it('round-trips the user id', async () => {
		const token = await signUserToken(key, 'user-1');

		await expect(verifyUserToken(key, token)).resolves.toBe('user-1');
	});

	it('rejects a token signed with another key', async () => {
		const token = await signUserToken(otherKey, 'user-1');

		await expect(verifyUserToken(key, token)).rejects.toThrow();
	});

	it('rejects garbage', async () => {
		await expect(verifyUserToken(key, 'not-a-token')).rejects.toThrow();
	});
});

describe('purpose tokens', () => {
	it('round-trips the claims', async () => {
		const token = await signPurposeToken(key, 'user-1', 'password_reset', {
			email: 'a@example.com',
			pwd: 1700000000000
		});

		await expect(verifyPurposeToken(key, token, 'password_reset')).resolves.toEqual({
			sub: 'user-1',
			email: 'a@example.com',
			pwd: 1700000000000
		});
	});

	it('defaults pwd to 0', async () => {
		const token = await signPurposeToken(key, 'user-1', 'verification', { email: 'a@example.com' });

		await expect(verifyPurposeToken(key, token, 'verification')).resolves.toMatchObject({ pwd: 0 });
	});

	it('is not valid for another purpose', async () => {
		const token = await signPurposeToken(key, 'user-1', 'verification', { email: 'a@example.com' });

		await expect(verifyPurposeToken(key, token, 'password_reset')).rejects.toThrow();
	});

	it('is not a sign-in token, and a sign-in token is not an email link', async () => {
		const link = await signPurposeToken(key, 'user-1', 'verification', { email: 'a@example.com' });
		const signIn = await signUserToken(key, 'user-1');

		await expect(verifyUserToken(key, link)).rejects.toThrow();
		await expect(verifyPurposeToken(key, signIn, 'verification')).rejects.toThrow();
	});
});
