import type { ConnectionState } from '@pouchbasejs/js-sdk';

import { Pouchbase } from '@pouchbasejs/js-sdk';

/**
 * Live updates in the dashboard, through the SDK's live client. The dashboard connects without
 * a token: the hub sees the session cookie of the same origin, so it is the admin and gets every
 * change, whatever the API rules say.
 */

let client: Pouchbase | null = null;

function pouch() {
	client ??= new Pouchbase(location.origin);
	return client;
}

/** How long to wait for more changes before `onChange` runs, so a bulk delete refreshes once. */
const DEBOUNCE_MS = 300;

/**
 * Calls `onChange` after records of the collection were created, updated or deleted, by anyone.
 * Create it during component initialisation; it follows `name` and stops when the component is
 * destroyed. `state` is the state of the connection.
 */
export class LiveCollection {
	state = $state<ConnectionState>('connecting');

	constructor(name: () => string, onChange: () => void) {
		$effect(() => {
			const collection = name();
			let timer: ReturnType<typeof setTimeout> | undefined;
			const live = pouch().live;

			this.state = 'connecting';

			const stopState = live.onState((changed, state) => {
				if (changed === collection) {
					this.state = state;
				}
			});
			const watching = live.watch(collection, () => {
				clearTimeout(timer);
				timer = setTimeout(onChange, DEBOUNCE_MS);
			});

			watching.ready.catch(() => {
				this.state = 'closed';
			});

			return () => {
				clearTimeout(timer);
				stopState();
				watching.stop();
			};
		});
	}
}
