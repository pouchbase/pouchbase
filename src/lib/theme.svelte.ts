import { browser } from '$app/env';
import { MediaQuery } from 'svelte/reactivity';

/** The colour scheme of the dashboard; `system` follows the operating system. */
export type Theme = 'light' | 'dark' | 'system';

/** Holds `light` or `dark`; without it the dashboard follows the system. */
export const THEME_COOKIE = 'pouchbase-theme';

export function parseTheme(value: string | null | undefined): Theme {
	return value === 'light' || value === 'dark' ? value : 'system';
}

const prefersDark = new MediaQuery('prefers-color-scheme: dark', false);

class ThemeState {
	// The server renders `data-theme` on <html> from the cookie (see `hooks/theme.ts`).
	#preference = $state<Theme>(
		browser ? parseTheme(document.documentElement.getAttribute('data-theme')) : 'system'
	);

	/** What the admin picked. */
	get preference(): Theme {
		return this.#preference;
	}

	set preference(theme: Theme) {
		this.#preference = theme;

		if (theme === 'system') {
			document.documentElement.removeAttribute('data-theme');
			document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
		} else {
			document.documentElement.setAttribute('data-theme', theme);
			document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
		}
	}

	/** Whether the dashboard is dark right now, for things CSS can't reach (such as Monaco). */
	get dark(): boolean {
		return this.#preference === 'dark' || (this.#preference === 'system' && prefersDark.current);
	}
}

export const theme = new ThemeState();
