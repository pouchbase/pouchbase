import * as pluginSdkUi from '@pouchbasejs/plugin-sdk/ui';
import * as ui from '@pouchbasejs/ui';
import * as badge from '@pouchbasejs/ui/badge';
import * as button from '@pouchbasejs/ui/button';
import * as callout from '@pouchbasejs/ui/callout';
import * as card from '@pouchbasejs/ui/card';
import * as empty from '@pouchbasejs/ui/empty';
import * as icon from '@pouchbasejs/ui/icon';
import * as checkbox from '@pouchbasejs/ui/inputs/checkbox';
import * as input from '@pouchbasejs/ui/inputs/input';
import * as select from '@pouchbasejs/ui/inputs/select';
import * as slider from '@pouchbasejs/ui/inputs/slider';
import * as textarea from '@pouchbasejs/ui/inputs/textarea';
import * as link from '@pouchbasejs/ui/link';
import * as meter from '@pouchbasejs/ui/meter';
import * as progress from '@pouchbasejs/ui/progress';
import * as scrollArea from '@pouchbasejs/ui/scroll-area';
import * as segmented from '@pouchbasejs/ui/segmented';
import * as skeleton from '@pouchbasejs/ui/skeleton';
import * as spinner from '@pouchbasejs/ui/spinner';
import * as swatch from '@pouchbasejs/ui/swatch';
import * as table from '@pouchbasejs/ui/table';
import * as thumbnail from '@pouchbasejs/ui/thumbnail';
import * as tile from '@pouchbasejs/ui/tile';
import * as tooltip from '@pouchbasejs/ui/tooltip';
/* eslint-disable svelte/no-svelte-internal -- compiled plugin components import Svelte's runtime
   internals, so the host has to lend them its own instances */
import * as svelte from 'svelte';
import * as animate from 'svelte/animate';
import * as attachments from 'svelte/attachments';
import * as easing from 'svelte/easing';
import * as events from 'svelte/events';
import * as internalClient from 'svelte/internal/client';
import * as discloseVersion from 'svelte/internal/disclose-version';
import * as motion from 'svelte/motion';
import * as reactivity from 'svelte/reactivity';
import * as store from 'svelte/store';
import * as transition from 'svelte/transition';

import {
	HOST_MODULES_KEY,
	hostModuleRegistry,
	type HostModuleId,
	type HostModuleRegistry,
	type ModuleNamespace
} from './host-module-ids';

/**
 * The dashboard's own instances of the modules plugin components may import (`HOST_MODULE_IDS`),
 * so a plugin component runs on the one Svelte runtime and the same `@pouchbasejs/ui` components
 * as the rest of the dashboard: it shares their context, reactivity and styles. Browser only;
 * `src/routes/(app)/+layout.svelte` and the module loader import this module lazily.
 *
 * Typed as a `Record` of every id, so a new id in the SDK fails the type check until it is here.
 */
const HOST_MODULES: Record<HostModuleId, () => Promise<ModuleNamespace>> = {
	svelte: async () => svelte,
	'svelte/internal/client': async () => internalClient,
	'svelte/internal/disclose-version': async () => discloseVersion,
	// Switches the whole runtime to legacy mode, so it only loads when a (non-runes) plugin
	// component needs it, never just because the dashboard has plugins.
	'svelte/internal/flags/legacy': () => import('svelte/internal/flags/legacy'),
	'svelte/store': async () => store,
	'svelte/transition': async () => transition,
	'svelte/animate': async () => animate,
	'svelte/easing': async () => easing,
	'svelte/motion': async () => motion,
	'svelte/reactivity': async () => reactivity,
	'svelte/events': async () => events,
	'svelte/attachments': async () => attachments,
	'@pouchbasejs/plugin-sdk/ui': async () => pluginSdkUi,
	'@pouchbasejs/ui': async () => ui,
	'@pouchbasejs/ui/badge': async () => badge,
	'@pouchbasejs/ui/button': async () => button,
	'@pouchbasejs/ui/callout': async () => callout,
	'@pouchbasejs/ui/card': async () => card,
	'@pouchbasejs/ui/empty': async () => empty,
	'@pouchbasejs/ui/icon': async () => icon,
	'@pouchbasejs/ui/link': async () => link,
	'@pouchbasejs/ui/meter': async () => meter,
	'@pouchbasejs/ui/progress': async () => progress,
	'@pouchbasejs/ui/scroll-area': async () => scrollArea,
	'@pouchbasejs/ui/segmented': async () => segmented,
	'@pouchbasejs/ui/skeleton': async () => skeleton,
	'@pouchbasejs/ui/spinner': async () => spinner,
	'@pouchbasejs/ui/swatch': async () => swatch,
	'@pouchbasejs/ui/table': async () => table,
	'@pouchbasejs/ui/thumbnail': async () => thumbnail,
	'@pouchbasejs/ui/tile': async () => tile,
	'@pouchbasejs/ui/tooltip': async () => tooltip,
	'@pouchbasejs/ui/inputs/checkbox': async () => checkbox,
	'@pouchbasejs/ui/inputs/input': async () => input,
	'@pouchbasejs/ui/inputs/select': async () => select,
	'@pouchbasejs/ui/inputs/slider': async () => slider,
	'@pouchbasejs/ui/inputs/textarea': async () => textarea
};
/* eslint-enable svelte/no-svelte-internal */

/**
 * Puts the host modules on `globalThis` (under `HOST_MODULES_KEY`) for the shims of the module
 * loader. Safe to call more than once: the first registry stays.
 */
export function registerHostModules(): HostModuleRegistry {
	const existing = hostModuleRegistry();

	if (existing) {
		return existing;
	}

	const resolved: HostModuleRegistry['resolved'] = {};
	const loading = new Map<HostModuleId, Promise<ModuleNamespace>>();

	const registry: HostModuleRegistry = {
		resolved,
		load(id) {
			let promise = loading.get(id);

			if (!promise) {
				promise = HOST_MODULES[id]().then((namespace) => (resolved[id] = namespace));
				loading.set(id, promise);
			}

			return promise;
		}
	};

	Object.defineProperty(globalThis, HOST_MODULES_KEY, { value: registry, configurable: true });

	return registry;
}
