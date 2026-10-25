/**
 * Rules for the icons of field types and pages (`icon` of a field or page contribution). The
 * dashboard draws them in one color, like its own icons (as a CSS mask, so their colors don't
 * matter), at 16 pixels. They are plain SVG images: no scripts, event handlers or references to
 * other files, which a mask would never run or load anyway, and a host serves every plugin image
 * sandboxed as well.
 */

/** Largest icon of a field type or page, in bytes. */
export const MAX_ICON_SIZE = 32 * 1024;

/** The XML prolog, comments and whitespace (a byte order mark too) an SVG file may start with. */
const PROLOG = /^(?:\s|<\?xml[^>]*\?>|<!--[\s\S]*?-->)*/;

/** A reference that stays inside the image: `#id`. */
const LOCAL_REFERENCE = /^\s*#/;

/** Why `content` can't be the icon of a field type or page; empty when it can. */
export function svgIconIssues(content: string): string[] {
	const issues: string[] = [];
	const size = new TextEncoder().encode(content).byteLength;

	if (size > MAX_ICON_SIZE) {
		issues.push(
			`is ${Math.ceil(size / 1024)} KiB; an icon may be at most ${MAX_ICON_SIZE / 1024} KiB`
		);
	}

	const body = content.replace(PROLOG, '');

	if (!/^<svg[\s>]/i.test(body) || !/<\/svg>\s*$/i.test(body)) {
		issues.push('is not an SVG image: it must start with <svg and end with </svg>');
	}

	if (/<!(?:DOCTYPE|ENTITY)/i.test(content)) {
		issues.push('has a <!DOCTYPE> or <!ENTITY>; icons are plain SVG');
	}

	if (/<script[\s>/]/i.test(content)) {
		issues.push('has a <script>; icons are images and run no code');
	}

	if (/<foreignObject[\s>/]/i.test(content)) {
		issues.push('has a <foreignObject>; icons are plain SVG');
	}

	if (/[\s"'/]on[a-z]+\s*=/i.test(content)) {
		issues.push('has an event handler attribute (on...="..."); icons run no code');
	}

	if (/javascript:/i.test(content)) {
		issues.push('has a javascript: URL; icons run no code');
	}

	for (const match of content.matchAll(/\b(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi)) {
		if (!LOCAL_REFERENCE.test(match[2] ?? '')) {
			issues.push(`refers to ${match[2]}; icons may only refer to their own elements (#id)`);
			break;
		}
	}

	for (const match of content.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
		if (!LOCAL_REFERENCE.test(match[2] ?? '')) {
			issues.push(`refers to ${match[2]}; icons may only refer to their own elements (#id)`);
			break;
		}
	}

	if (/@import/i.test(content)) {
		issues.push('has an @import; icons may only refer to their own elements (#id)');
	}

	return issues;
}
