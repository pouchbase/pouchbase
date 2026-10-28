/**
 * The decision behind an OAuth sign-in: which user the provider's profile belongs to. Pure, so
 * the rule is testable; `OAuthService` does the lookups and the writes around it.
 */

export type SignInProfile = {
	email: string | null;
	/** Whether the provider vouches for the address. */
	emailVerified: boolean;
};

export type SignInLookup = {
	/** The user linked to this provider account before, when they still exist. */
	linkedUserId: string | null;
	/** The user that already has the profile's email address. */
	emailOwnerId: string | null;
};

export type SignInDecision =
	/** Signed in before: sign in again. */
	| { action: 'sign-in'; userId: string }
	/** First time with this provider, but the (verified) address belongs to a user: link the account to them. */
	| { action: 'link'; userId: string }
	/** Nobody has the address (or there is none): sign up. */
	| { action: 'create' }
	/** The address belongs to a user, but the provider didn't verify it; anyone could claim it. */
	| { action: 'conflict' };

/** Email addresses are compared lowercase. */
export function normalizeEmail(email: string | null | undefined): string | null {
	return email?.trim().toLowerCase() || null;
}

export function decideSignIn(profile: SignInProfile, lookup: SignInLookup): SignInDecision {
	if (lookup.linkedUserId) {
		return { action: 'sign-in', userId: lookup.linkedUserId };
	}

	if (!lookup.emailOwnerId) {
		return { action: 'create' };
	}

	return profile.emailVerified
		? { action: 'link', userId: lookup.emailOwnerId }
		: { action: 'conflict' };
}
