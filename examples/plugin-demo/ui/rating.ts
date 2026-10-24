/**
 * Shared by the input and the cell. A TypeScript module in `ui/` is compiled to JavaScript by the
 * CLI, and the components import it with a relative path.
 */

export const MAX_RATING = 5;

export const RATINGS = Array.from({ length: MAX_RATING }, (_, index) => index + 1);

/** `3` → `★★★☆☆`. */
export function stars(rating: number) {
	return '★'.repeat(rating) + '☆'.repeat(MAX_RATING - rating);
}
