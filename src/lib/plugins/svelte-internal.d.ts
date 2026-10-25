// Svelte's runtime internals have no types; the host modules only pass them on to plugin
// components, which the Svelte compiler wrote against them.
declare module 'svelte/internal/client';
declare module 'svelte/internal/disclose-version';
declare module 'svelte/internal/flags/legacy';
