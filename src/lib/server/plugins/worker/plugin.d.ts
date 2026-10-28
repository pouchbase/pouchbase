import type { ServerDefinition } from '@pouchbasejs/plugin-sdk/server';

/** `plugin.js` of a plugin's Worker: the plugin's bundled `server.js`, which default-exports its definition. */
declare const definition: ServerDefinition | undefined;

export default definition;
