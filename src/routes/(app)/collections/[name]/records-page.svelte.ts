import { untrack } from 'svelte';
import { SvelteSet, SvelteURLSearchParams } from 'svelte/reactivity';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import type { SignInMethod } from '#lib/auth/sign-in-methods.js';
import type { GridRecord } from './grid';
import { getRecord } from './records.remote';

/**
 * State of the records page: paging and sorting in the URL, the selected rows and the record
 * sheet. Must be created while a component initializes, as it runs an effect for `?record=<id>`.
 */
export class RecordsPage {
	#name: () => string;
	#records: () => GridRecord[];

	/** Only rows on the current page count as selected. */
	readonly selection = new SvelteSet<string>();

	sheetOpen = $state(false);
	opened = $state<GridRecord | null>(null);
	/**
	 * The collection the sheet was opened in: a link to another collection closes it until the
	 * linked record is in.
	 */
	openedIn = $state('');
	/** Sign-in methods of a user opened through a link, who may not be on the current page. */
	openedSignInMethods = $state<SignInMethod[]>();

	/** Paging and sorting live in the URL, so they survive a reload and can be shared. */
	readonly args = $derived.by(() => {
		const search = page.url.searchParams;
		const order = search.get('order');

		return {
			collection: this.#name(),
			page: Math.max(1, Number(search.get('page')) || 1),
			sort: search.get('sort') ?? undefined,
			order: order === 'asc' || order === 'desc' ? (order as 'asc' | 'desc') : undefined
		};
	});

	readonly selectedIds = $derived.by(() =>
		this.#records()
			.filter((row) => this.selection.has(row._key))
			.map((row) => row._key)
	);

	readonly allSelected = $derived.by(
		() => this.#records().length > 0 && this.selectedIds.length === this.#records().length
	);

	/**
	 * The latest version of the open record, so the sheet shows changes made elsewhere (e.g. an
	 * edited image) after the data refreshes.
	 */
	readonly editing = $derived.by(
		() =>
			this.opened && (this.#records().find((row) => row._key === this.opened?._key) ?? this.opened)
	);

	/** The sheet only shows while the page is still on the collection it was opened in. */
	readonly sheetVisible = $derived.by(() => this.sheetOpen && this.openedIn === this.#name());

	readonly linkedId = $derived(page.url.searchParams.get('record'));

	constructor(name: () => string, records: () => GridRecord[]) {
		this.#name = name;
		this.#records = records;
		this.openedIn = untrack(name);

		// `?record=<id>` opens that record, e.g. from a link to a related record. It may be on
		// another page of the grid, so it's read on its own.
		$effect(() => {
			const collection = this.#name();
			const id = this.linkedId;

			if (!id) {
				return;
			}

			let current = true;

			void getRecord({ collection, id }).then((found) => {
				if (current && found) {
					this.openRecord(found.item as GridRecord, found.signInMethods);
				}
			});

			return () => {
				current = false;
			};
		});
	}

	navigate = (changes: Record<string, string | null>, options?: { replaceState?: boolean }) => {
		const search = new SvelteURLSearchParams(page.url.search);

		for (const [key, value] of Object.entries(changes)) {
			if (value === null) {
				search.delete(key);
			} else {
				search.set(key, value);
			}
		}

		// SvelteKit 3 keeps scroll position and focus on `goto` unless `reset` is set.
		return goto(resolve(`/(app)/collections/[name]?${search}`, { name: this.#name() }), options);
	};

	toggleAll = () => {
		if (this.allSelected) {
			this.selection.clear();
		} else {
			for (const row of this.#records()) {
				this.selection.add(row._key);
			}
		}
	};

	toggle = (id: string) => {
		if (this.selection.has(id)) {
			this.selection.delete(id);
		} else {
			this.selection.add(id);
		}
	};

	openRecord = (record: GridRecord | null, signIn?: SignInMethod[]) => {
		this.opened = record;
		this.openedIn = this.#name();
		this.openedSignInMethods = signIn;
		this.sheetOpen = true;
	};

	setSheetOpen = (open: boolean) => {
		this.sheetOpen = open;

		// Closing a record opened through a link drops it from the URL, so a reload doesn't reopen it.
		if (!open && page.url.searchParams.has('record')) {
			void this.navigate({ record: null }, { replaceState: true });
		}
	};
}
