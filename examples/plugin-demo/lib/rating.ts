import type { Check } from './check.js';

/**
 * Shared by the field type (server code) and its input and preview (UI). The server code bundles it;
 * because the components import it, the CLI also compiles it to `ui/lib/rating.js` in the bundle.
 * Import it by its `.js` name, as it is in the bundle.
 */

export const MAX_RATING = 5;

export const RATINGS = Array.from({ length: MAX_RATING }, (_, index) => index + 1);

/** What each number of stars means, shown while choosing. */
export const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * A whole number from 1 to 5. The record form submits it as a string and the API may send a
 * number, so both are accepted; it is stored as an integer.
 */
export function checkRating(value: unknown): Check<number> {
	const rating = Number(value);

	if (
		value === '' ||
		value === null ||
		!Number.isInteger(rating) ||
		rating < 1 ||
		rating > MAX_RATING
	) {
		return { valid: false, message: `Choose a rating from 1 to ${MAX_RATING}` };
	}

	return { valid: true, stored: rating };
}
