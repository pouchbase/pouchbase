import { formatFileSize } from '../../../format.js';

/** The comma-separated rules of an `accept` attribute, trimmed and without empty entries. */
function acceptRules(accept: string) {
	return accept
		.split(',')
		.map((rule) => rule.trim())
		.filter(Boolean);
}

/** Whether `file` matches an `accept` attribute (extensions, `type/*` wildcards or exact types). */
export function matchesAccept(
	file: Pick<File, 'name' | 'type'>,
	accept: string | null | undefined
) {
	if (!accept) {
		return true;
	}

	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();

	return acceptRules(accept)
		.map((rule) => rule.toLowerCase())
		.some((rule) => {
			if (rule.startsWith('.')) {
				return name.endsWith(rule);
			}

			if (rule.endsWith('/*')) {
				return type.startsWith(rule.slice(0, -1));
			}

			return type === rule;
		});
}

/** Splits `incoming` into accepted files and a message explaining the rejected ones (or null). */
export function filterFiles<T extends Pick<File, 'name' | 'type' | 'size'>>(
	incoming: T[],
	accept: string | null | undefined,
	maxSize: number | undefined
): { accepted: T[]; rejection: string | null } {
	const accepted: T[] = [];
	const problems: string[] = [];

	for (const file of incoming) {
		if (!matchesAccept(file, accept)) {
			problems.push(`${file.name} is not an accepted file type.`);
		} else if (maxSize && file.size > maxSize) {
			problems.push(`${file.name} is larger than ${formatFileSize(maxSize)}.`);
		} else {
			accepted.push(file);
		}
	}

	return { accepted, rejection: problems.length ? problems.join(' ') : null };
}

/** The default hint: the accepted types and the size limit, e.g. `image/*, .pdf up to 5 MB`. */
export function describeAccept(
	accept: string | null | undefined,
	multiple: boolean,
	maxSize: number | undefined
) {
	const types = accept ? acceptRules(accept).join(', ') : '';
	const size = maxSize ? `up to ${formatFileSize(maxSize)}` : '';

	return [types || (multiple ? 'Any files' : 'Any file'), size].filter(Boolean).join(' ');
}

/** The Iconify icon for a file's MIME type. */
export function iconFor(type: string) {
	if (type.startsWith('image/')) {
		return 'lucide:file-image';
	}

	if (type.startsWith('video/')) {
		return 'lucide:file-video-camera';
	}

	if (type.startsWith('audio/')) {
		return 'lucide:file-audio';
	}

	if (type.startsWith('text/') || type === 'application/pdf' || type === 'application/json') {
		return 'lucide:file-text';
	}

	if (/zip|tar|gzip|compressed|rar|7z/.test(type)) {
		return 'lucide:file-archive';
	}

	return 'lucide:file';
}

/** Whether a drag event carries files (not text or links). */
export function hasFiles(event: DragEvent) {
	return !!event.dataTransfer?.types.includes('Files');
}
