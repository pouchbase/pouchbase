import type { PouchbaseClient } from '../client.js';

/** Options for `pouch.files.url()`. */
export type FileUrlOptions = {
	/**
	 * A thumbnail size: `WxH` (cropped from the center), `WxH:top`, `WxH:bottom`, `WxH:fit`
	 * (fitted without cropping), or `Wx0` / `0xH` (scaled to one side), such as `100x100:fit`.
	 * Only sizes configured on the `files` collection are served; for others the original is
	 * returned.
	 */
	size?: string;
	/** Serve the file as a download instead of inline. */
	download?: boolean;
};

/** Files of the built-in `files` collection. Files are public; their ids are random. */
export class FilesService {
	readonly #pouch: PouchbaseClient;

	constructor(pouch: PouchbaseClient) {
		this.#pouch = pouch;
	}

	/** URL of a file (`GET /api/files/<id>`), for an `<img src>` or a download link. */
	url(file: string | { id: string }, options: FileUrlOptions = {}): string {
		const id = typeof file === 'string' ? file : file.id;

		return this.#pouch.url(`/api/files/${encodeURIComponent(id)}`, {
			size: options.size || undefined,
			download: options.download ? 1 : undefined
		});
	}
}
