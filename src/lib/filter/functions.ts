/**
 * Functions a condition can call (`contains(title, "svelte")`, `year(published_at) == 2026`).
 * Shared between the parser, which checks names, arguments and where a call may stand, the
 * suggestions of the condition editor and the docs; the server compiles each one to SQL
 * (`src/lib/server/filter.ts`).
 *
 * Dates are in UTC. A date argument can be a Date field (ISO 8601 text), a Created or Updated
 * field (milliseconds), `now()`, `today()`, another date function or a string such as
 * `"2026-01-01"`; a number counts as milliseconds since 1970.
 */

/** What a function gives: `boolean` functions are conditions on their own, the others values. */
export type FilterFunctionResult = 'boolean' | 'text' | 'number' | 'date';

export type FilterFunctionArgument = {
	name: string;
	optional?: boolean;
	/** The argument must be one of these strings (a literal), e.g. the unit of `date_add()`. */
	units?: readonly string[];
};

export type FilterFunction = {
	group: 'Text' | 'Dates' | 'Numbers' | 'Lists';
	args: readonly FilterFunctionArgument[];
	returns: FilterFunctionResult;
	description: string;
	/** An example call, for suggestions and the docs. */
	example: string;
};

/** Units of `date_add()`; the singular (`"day"`) works too. */
export const DATE_ADD_UNITS = [
	'years',
	'months',
	'weeks',
	'days',
	'hours',
	'minutes',
	'seconds'
] as const;

/** Units of `start_of()`; the plural (`"days"`) works too. */
export const START_OF_UNITS = ['year', 'month', 'week', 'day', 'hour'] as const;

const text = (name = 'text'): FilterFunctionArgument => ({ name });
const date = (name = 'date'): FilterFunctionArgument => ({ name });

export const FILTER_FUNCTIONS = {
	contains: {
		group: 'Text',
		args: [text(), text('search')],
		returns: 'boolean',
		description: 'The text contains search, in any case.',
		example: 'contains(title, "svelte")'
	},
	starts_with: {
		group: 'Text',
		args: [text(), text('prefix')],
		returns: 'boolean',
		description: 'The text starts with prefix, in any case.',
		example: 'starts_with(slug, "release-")'
	},
	ends_with: {
		group: 'Text',
		args: [text(), text('suffix')],
		returns: 'boolean',
		description: 'The text ends with suffix, in any case.',
		example: 'ends_with(email, "@example.com")'
	},
	like: {
		group: 'Text',
		args: [text(), text('pattern')],
		returns: 'boolean',
		description:
			'The text matches the pattern, in any case: % is any text, _ one character (at most 50 bytes).',
		example: 'like(code, "A_-%")'
	},
	lower: {
		group: 'Text',
		args: [text()],
		returns: 'text',
		description: 'The text in lowercase.',
		example: 'lower(status) == "draft"'
	},
	upper: {
		group: 'Text',
		args: [text()],
		returns: 'text',
		description: 'The text in uppercase.',
		example: 'upper(country) == "NL"'
	},
	trim: {
		group: 'Text',
		args: [text()],
		returns: 'text',
		description: 'The text without spaces at the start and end.',
		example: 'trim(name) != ""'
	},
	length: {
		group: 'Text',
		args: [text()],
		returns: 'number',
		description: 'The number of characters; 0 for an empty value.',
		example: 'length(title) <= 80'
	},
	now: {
		group: 'Dates',
		args: [],
		returns: 'date',
		description: 'The current date and time.',
		example: 'published_at <= now()'
	},
	today: {
		group: 'Dates',
		args: [],
		returns: 'date',
		description: 'Today, as YYYY-MM-DD.',
		example: 'date(published_at) == today()'
	},
	date: {
		group: 'Dates',
		args: [date()],
		returns: 'date',
		description: 'The day of a date, as YYYY-MM-DD.',
		example: 'date(created_at) == "2026-10-25"'
	},
	date_add: {
		group: 'Dates',
		args: [date(), { name: 'amount' }, { name: 'unit', units: DATE_ADD_UNITS }],
		returns: 'date',
		description:
			'The date plus an amount of years, months, weeks, days, hours, minutes or seconds; a negative amount goes back.',
		example: 'created_at >= date_add(now(), -7, "days")'
	},
	start_of: {
		group: 'Dates',
		args: [date(), { name: 'unit', units: START_OF_UNITS }],
		returns: 'date',
		description: 'The start of the year, month, week (Monday), day or hour of a date.',
		example: 'created_at >= start_of(now(), "month")'
	},
	year: {
		group: 'Dates',
		args: [date()],
		returns: 'number',
		description: 'The year of a date.',
		example: 'year(published_at) == 2026'
	},
	month: {
		group: 'Dates',
		args: [date()],
		returns: 'number',
		description: 'The month of a date, 1 to 12.',
		example: 'month(birthday) == month(now())'
	},
	day: {
		group: 'Dates',
		args: [date()],
		returns: 'number',
		description: 'The day of the month, 1 to 31.',
		example: 'day(due_at) == 1'
	},
	weekday: {
		group: 'Dates',
		args: [date()],
		returns: 'number',
		description: 'The day of the week, 1 (Monday) to 7 (Sunday).',
		example: 'weekday(starts_at) <= 5'
	},
	hour: {
		group: 'Dates',
		args: [date()],
		returns: 'number',
		description: 'The hour of a date, 0 to 23.',
		example: 'hour(created_at) < 12'
	},
	minute: {
		group: 'Dates',
		args: [date()],
		returns: 'number',
		description: 'The minute of a date, 0 to 59.',
		example: 'minute(starts_at) == 30'
	},
	abs: {
		group: 'Numbers',
		args: [{ name: 'number' }],
		returns: 'number',
		description: 'The number without its sign.',
		example: 'abs(balance) < 100'
	},
	round: {
		group: 'Numbers',
		args: [{ name: 'number' }, { name: 'digits', optional: true }],
		returns: 'number',
		description: 'The number rounded, to a number of decimals (0 by default).',
		example: 'round(rating) == 4'
	},
	count: {
		group: 'Lists',
		args: [{ name: 'field' }],
		returns: 'number',
		description:
			'The number of items of a multiple relation, file or list field; 0 when it is empty.',
		example: 'count(tags) >= 2'
	}
} as const satisfies Record<string, FilterFunction>;

export type FilterFunctionName = keyof typeof FILTER_FUNCTIONS;

export function isFilterFunction(name: string): name is FilterFunctionName {
	return Object.hasOwn(FILTER_FUNCTIONS, name);
}

/** How a function is called, e.g. `date_add(date, amount, unit)`. */
export function functionSignature(name: FilterFunctionName) {
	const args = FILTER_FUNCTIONS[name].args.map((arg: FilterFunctionArgument) =>
		arg.optional ? `${arg.name}?` : arg.name
	);

	return `${name}(${args.join(', ')})`;
}

/** A unit as `date_add()` and `start_of()` know it (`"day"` and `"days"` both work), or `null`. */
export function normalizeUnit(name: FilterFunctionName, unit: string): string | null {
	const units = (FILTER_FUNCTIONS[name].args as readonly FilterFunctionArgument[]).find(
		(arg) => arg.units
	)?.units;

	if (!units) {
		return null;
	}

	const lower = unit.toLowerCase();

	return (
		units.find(
			(candidate) => candidate === lower || candidate === `${lower}s` || `${candidate}s` === lower
		) ?? null
	);
}
