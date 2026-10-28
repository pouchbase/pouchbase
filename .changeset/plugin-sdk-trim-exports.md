---
'@pouchbasejs/plugin-sdk': minor
---

Remove unused exports from the package root: `defineManifest`, `impliedCategories` (use `effectiveCategories`), `pluginCollectionPrefix` (use `pluginCollectionName`), `withPackageDefaults`, the Zod sub-schemas of the manifest, bundle and registry API (`manifestSchema`, `bundleSchema`, `pluginVersionSchema`, ...), the internal constants `MANIFEST_FILE`, `PACKAGE_DEFAULT_KEYS`, `GENERATED_MANIFEST_KEYS`, `PLUGIN_SETTING_TYPES`, `SETTING_KEY_PATTERN`, `MAX_PLUGIN_SETTINGS`, `COLLECTION_RULE_ACTIONS`, `MAX_COLLECTION_NAME_LENGTH`, `BUNDLE_FORMAT`, `BUNDLE_VERSION`, `BUNDLE_PART_LENGTH` and `SVELTE_COMPILE_OPTIONS`, and the types `PackageJson`, `PluginManifestInput` and `PluginSettingType`.
