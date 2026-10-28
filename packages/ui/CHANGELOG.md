# @pouchbasejs/ui

## 0.2.0

### Minor Changes

- [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add dark mode: `theme.css` redefines the palette under `data-theme="dark"` on `<html>` (or the system setting unless it is `data-theme="light"`), and a `dark:` variant for the rest.

- [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - `Icon.Root` takes `src` to show an SVG in the current text color like the other icons, and `Select` items take `iconSrc` and `group`.

- [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `@pouchbasejs/ui/tokens.css`, the dashboard's design tokens without the base styles, for plugins and other Tailwind projects.

## 0.1.0

### Minor Changes

- [`6252403`](https://github.com/pouchbase/pouchbase/commit/625240313e5a63639c5e982a12671350d14219a7) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - New package `@pouchbasejs/ui` with the Svelte UI primitives of the Pouchbase dashboard (buttons, inputs, cards, tables, tooltips and more), its Tailwind theme and the Iconify Vite plugin.
