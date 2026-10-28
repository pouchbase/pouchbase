import type { Area } from '#lib/components/ui/cropper/index.js';
import {
	DEFAULT_JPEG_QUALITY,
	defaultOutputFormat,
	NEUTRAL_ADJUSTMENTS,
	type Adjustments,
	type OutputFormat
} from '#lib/files/image-edits.js';

export type Rotation = 0 | 90 | 180 | 270;

/** Everything the user can change; one snapshot of it is one step in the undo history. */
export type EditorState = {
	rotation: Rotation;
	flipHorizontal: boolean;
	flipVertical: boolean;
	/** Key of `ASPECTS` in the crop panel. */
	aspect: string;
	area: Area;
	resize: { enabled: boolean; width: number };
	adjustments: Adjustments;
	format: OutputFormat;
	quality: number;
};

export type ImageEditorSource = {
	/** The loaded original. */
	readonly image: HTMLImageElement;
	/** Current name and type of the file, e.g. to name a converted copy. */
	readonly name: string;
	readonly mimeType: string;
};

type Size = { width: number; height: number };

/** Longest side of the preview canvas; edits are applied to the full image on the server. */
const PREVIEW_SIZE = 1600;

export function rotatedSize(image: HTMLImageElement, rotation: Rotation) {
	return rotation % 180
		? { width: image.naturalHeight, height: image.naturalWidth }
		: { width: image.naturalWidth, height: image.naturalHeight };
}

export function initialState(source: ImageEditorSource): EditorState {
	const { width, height } = rotatedSize(source.image, 0);

	return {
		rotation: 0,
		flipHorizontal: false,
		flipVertical: false,
		aspect: 'free',
		area: { x: 0, y: 0, width, height },
		resize: { enabled: false, width },
		adjustments: { ...NEUTRAL_ADJUSTMENTS },
		format: defaultOutputFormat(source.mimeType),
		quality: DEFAULT_JPEG_QUALITY
	};
}

/** Width divided by height for an aspect key, or `null` for a free selection. */
export function aspectRatio(key: string, size: Size) {
	if (key === 'free') {
		return null;
	}

	if (key === 'original') {
		return size.width / size.height;
	}

	const [width, height] = key.split(':').map(Number);

	return width / height;
}

/** The largest centered area with the given aspect ratio, or the whole image. */
export function fullArea(size: Size, ratio: number | null): Area {
	const { width, height } = size;

	if (!ratio) {
		return { x: 0, y: 0, width, height };
	}

	let areaWidth = width;
	let areaHeight = areaWidth / ratio;

	if (areaHeight > height) {
		areaHeight = height;
		areaWidth = areaHeight * ratio;
	}

	return {
		x: (width - areaWidth) / 2,
		y: (height - areaHeight) / 2,
		width: areaWidth,
		height: areaHeight
	};
}

/**
 * Draws the rotated and flipped image, in the same order the server applies the edits (rotate,
 * then flip, then crop). With `region` only that part is drawn.
 */
export function drawPreview(
	canvas: HTMLCanvasElement,
	image: HTMLImageElement,
	edit: EditorState,
	region: Area | null
) {
	const { width, height } = rotatedSize(image, edit.rotation);
	const view = region ?? { x: 0, y: 0, width, height };
	const scale = Math.min(1, PREVIEW_SIZE / Math.max(view.width, view.height));
	const context = canvas.getContext('2d');

	canvas.width = Math.max(1, Math.round(view.width * scale));
	canvas.height = Math.max(1, Math.round(view.height * scale));

	if (!context) {
		return;
	}

	context.translate(-view.x * scale, -view.y * scale);
	context.translate((width * scale) / 2, (height * scale) / 2);
	context.scale(edit.flipHorizontal ? -1 : 1, edit.flipVertical ? -1 : 1);
	context.rotate((edit.rotation * Math.PI) / 180);
	context.drawImage(
		image,
		(-image.naturalWidth * scale) / 2,
		(-image.naturalHeight * scale) / 2,
		image.naturalWidth * scale,
		image.naturalHeight * scale
	);
}
