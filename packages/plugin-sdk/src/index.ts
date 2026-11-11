export { API_VERSION, SUPPORTED_API_VERSIONS, isSupportedApiVersion } from './api-version.js';
export {
	PLUGIN_CATEGORIES,
	PLUGIN_CATEGORY_LABELS,
	CATEGORY_PATTERN,
	MAX_CATEGORIES,
	isPluginCategory,
	unknownCategoryIssues,
	effectiveCategories,
	type PluginCategory
} from './categories.js';
export {
	MANIFEST_SCHEMA_URL,
	UI_DIR,
	PLUGIN_ID_PATTERN,
	PLUGIN_FIELD_TYPE_PATTERN,
	pluginFieldTypeId,
	splitPluginFieldType,
	PROVIDER_ID_PATTERN,
	RESERVED_PROVIDER_IDS,
	PAGE_LAYOUTS,
	parseManifest,
	checkCompatibility,
	type PluginManifest,
	type FieldContribution,
	type PageContribution,
	type PageLayout,
	type AuthProviderContribution,
	type PluginPermissions,
	type ManifestIssue,
	type ManifestResult
} from './manifest.js';
export {
	COLLECTION_NAME_PATTERN,
	pluginCollectionName,
	type CollectionContribution
} from './collections.js';
export {
	FUNCTION_NAME_PATTERN,
	MAX_FUNCTION_NAME_LENGTH,
	pluginFunctionName,
	type FunctionContribution
} from './functions.js';
export { pluginSettingsSchema, type PluginSetting } from './settings-schema.js';
export { resolveSettings } from './settings.js';
export { manifestJsonSchema } from './manifest-json-schema.js';
export {
	MAX_BUNDLE_SIZE,
	SERVER_FILE,
	parseBundle,
	serverCodeIssues,
	serializeBundle,
	splitBundle,
	computeIntegrity,
	verifyIntegrity,
	type PluginBundle,
	type BundleResult
} from './bundle.js';
export { MAX_ICON_SIZE, svgIconIssues } from './svg.js';
export {
	REGISTRY_API_PREFIX,
	DEFAULT_REGISTRY_URL,
	contributionSummary,
	createRegistryClient,
	RegistryError,
	type PluginSummary,
	type PluginVersion,
	type ContributionSummary,
	type PluginDetails,
	type PluginList,
	type RegistryErrorBody,
	type SearchOptions,
	type RegistryClient,
	type RegistryClientOptions
} from './registry.js';
export {
	compileUi,
	formatCompileIssue,
	resolveRelative,
	type CompiledModule,
	type CompileIssue,
	type CompiledUi,
	type SvelteCompiler
} from './compile.js';
export { hostMatches, blockedReason } from './network.js';
