/** The files `init` and `add` write, from the templates in this folder. */

export {
	EXAMPLE_PROVIDER_HOST,
	entrySource,
	fieldEntry,
	functionEntry,
	pageEntry,
	providerEntry,
	routeEntry,
	type PluginEntry
} from './entries.js';
export {
	PLUGIN_FILE,
	pluginFileSource,
	settingSource,
	type SettingTemplate
} from './plugin-file.js';
export {
	TEMPLATES,
	TEMPLATE_DESCRIPTIONS,
	isTemplate,
	projectFiles,
	type PluginTemplate
} from './project.js';
export { camelCase, freeName, indented, json, pascalCase, title, type Files } from './source.js';
