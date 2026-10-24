/** Small formatting helpers for what the CLI prints. */

/** Size in KiB, e.g. `12 KiB`. */
export function kib(bytes: number) {
	return `${Math.max(1, Math.ceil(bytes / 1024))} KiB`;
}

/** Time since `start` (from `performance.now()`), e.g. `840 ms` or `2.4 s`. */
export function elapsed(start: number) {
	const ms = performance.now() - start;

	return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** `1 field`, `2 fields`. */
export function count(n: number, singular: string, plural = `${singular}s`) {
	return `${n} ${n === 1 ? singular : plural}`;
}
