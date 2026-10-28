/** Helpers for the source code that `init` and `add` write. */

/** The files `init` and `add` write: path → contents. */

export type Files = Record<string, string>;

/** `color-picker` → `Color picker`, `rich_color` → `Rich color`, `reports/monthly` → `Monthly`. */
export function title(id: string) {
	const words = (id.split('/').at(-1) ?? id).split(/[-_]/).join(' ');

	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** JSON as the templates write it: tab-indented, with a final newline. */
export function json(value: unknown) {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

/** The provider id for a plugin id: `auth-acme` → `acme`. */
export function providerIdFor(pluginId: string) {
	return pluginId.replace(/^auth-(?=.)/, '');
}

/** `acme` → `acme`, `my-sso` → `'my-sso'`. */
export function objectKey(id: string) {
	return /^[a-z_$][\w$]*$/i.test(id) ? id : `'${id}'`;
}

/** `it's` → `'it\'s'`: a single-quoted string literal. */
export function quote(value: string) {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** `source` with every line after the first indented by `indent`. */
export function indented(source: string, indent: string) {
	return source.replace(/\n/g, `\n${indent}`);
}

/** Words that can't name an import. */
const RESERVED_WORDS = new Set(
	'arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield'.split(
		' '
	)
);

/** `my-sso`, `rich_color`, `reports/monthly` → `mySso`, `richColor`, `reportsMonthly`. */
export function camelCase(id: string) {
	const name = id
		.replace(/^[^a-z0-9]+/i, '')
		.replace(/[^a-z0-9]+([a-z0-9])/gi, (_, char: string) => char.toUpperCase())
		.replace(/[^a-z0-9]/gi, '');

	return /^[0-9]/.test(name) ? `_${name}` : name;
}

/** `stats`, `reports/monthly` → `Stats`, `ReportsMonthly`: the name of a component. */
export function pascalCase(id: string) {
	const name = camelCase(id).replace(/^_/, '');

	return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * A name for an import: `name`, else `name` with `suffix`, else with a number, whichever `taken`
 * doesn't refuse and isn't a reserved word.
 */
export function freeName(name: string, suffix: string, taken: (name: string) => boolean) {
	const candidates = [name, `${name}${suffix}`];

	for (let index = 2; ; index++) {
		const candidate = candidates.shift() ?? `${name}${suffix}${index}`;

		if (candidate && !RESERVED_WORDS.has(candidate) && !taken(candidate)) {
			return candidate;
		}
	}
}
