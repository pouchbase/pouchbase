import type { FieldOptions, FieldTypeId } from './types';

/** How a computed field turns its source value into its own value. */
export const COMPUTED_TRANSFORMS = {
	slug: {
		label: 'Slug',
		description: 'Lowercase words joined by dashes, e.g. hello-world.'
	},
	lowercase: { label: 'Lowercase', description: 'The source text in lowercase.' },
	uppercase: { label: 'Uppercase', description: 'The source text in uppercase.' },
	script: {
		label: 'Script',
		description: 'A JavaScript function that gets the whole record.'
	}
} as const satisfies Record<string, { label: string; description: string }>;

export type ComputedTransform = keyof typeof COMPUTED_TRANSFORMS;

export const COMPUTED_TRANSFORM_IDS = Object.keys(COMPUTED_TRANSFORMS) as [
	ComputedTransform,
	...ComputedTransform[]
];

/** Longest script a computed field can have, in characters. */
export const MAX_SCRIPT_LENGTH = 10_000;

/** Starting point for a new script. */
export const SCRIPT_TEMPLATE = [
	'// `record` has every field of the collection.',
	'// `ctx` has the collection, isNew, the previous record and helpers such as slugify.',
	'// Return the value of this field.',
	'return ctx.slugify(String(record.id));',
	''
].join('\n');

/** Whether a computed field is calculated from a single source field (not a script). */
export function hasComputedSource(transform: ComputedTransform | undefined) {
	return !!transform && transform !== 'script';
}

/** Field types a computed field can be calculated from. */
export const COMPUTED_SOURCE_TYPES = new Set<FieldTypeId>([
	'text',
	'rich_text',
	'email',
	'url',
	'number',
	'integer',
	'date'
]);

/** Options of a computed field, cleaned up; `null` when they are incomplete. */
export function computedOptions(options: FieldOptions): FieldOptions | null {
	const { transform, source, script } = options;

	if (!transform || !Object.hasOwn(COMPUTED_TRANSFORMS, transform)) {
		return null;
	}

	if (hasComputedSource(transform)) {
		return source ? { transform, source } : null;
	}

	return script?.trim() && script.length <= MAX_SCRIPT_LENGTH ? { transform, script } : null;
}

/** `Héllo, Wörld!` → `hello-world`. */
export function slugify(value: string) {
	return (
		value
			.normalize('NFKD')
			// Drops the accents that NFKD split off, so `é` becomes `e`.
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
	);
}

/**
 * The value of a computed field for a stored source value; `null` when there is nothing to
 * compute from. Rich text is reduced to its text first.
 */
export function computeValue(
	transform: ComputedTransform,
	sourceType: FieldTypeId,
	value: unknown
): string | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	let text = String(value);

	if (sourceType === 'rich_text') {
		text = text
			.replace(/<[^>]+>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/[#*_`>~]+/g, ' ');
	}

	text = text.replace(/\s+/g, ' ').trim();

	switch (transform) {
		case 'script':
			// Scripts run in a sandbox on the server, not here.
			return null;
		case 'slug':
			text = slugify(text);
			break;
		case 'lowercase':
			text = text.toLowerCase();
			break;
		case 'uppercase':
			text = text.toUpperCase();
			break;
	}

	return text === '' ? null : text;
}
