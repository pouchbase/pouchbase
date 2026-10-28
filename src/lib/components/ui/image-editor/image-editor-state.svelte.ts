import type { Attachment } from 'svelte/attachments';
import type { Area } from '#lib/components/ui/cropper/index.js';
import {
	cssFilter,
	defaultOutputFormat,
	OUTPUT_FORMATS,
	type Adjustments,
	type OutputFormat
} from '#lib/files/image-edits.js';
import {
	aspectRatio,
	drawPreview,
	fullArea,
	initialState,
	rotatedSize,
	type EditorState,
	type ImageEditorSource,
	type Rotation
} from './image-editor-geometry.js';

export type { EditorState, ImageEditorSource, Rotation } from './image-editor-geometry.js';
export type Tab = 'crop' | 'adjust' | 'filters' | 'export';

export const MAX_DIMENSION = 8000;
const MAX_HISTORY = 50;

/** The image editor's state with its undo history, shared by the editor's parts. */
export class ImageEditorState {
	readonly #source: ImageEditorSource;

	tab = $state<Tab>('crop');
	comparing = $state(false);
	edit = $state<EditorState>() as EditorState;

	// Undo history: `#committed` is the current step, `past` and `future` the ones around it.
	#committed: EditorState;
	past = $state.raw<EditorState[]>([]);
	future = $state.raw<EditorState[]>([]);

	readonly #pristineJson: string;
	readonly pristine = $derived.by(() => JSON.stringify(this.edit) === this.#pristineJson);

	/** Image size after rotating; crop coordinates are in this space, like on the server. */
	readonly size = $derived.by(() => rotatedSize(this.#source.image, this.edit.rotation));

	readonly cropWidth = $derived(Math.round(this.edit.area.width));
	readonly cropHeight = $derived(Math.round(this.edit.area.height));
	// Resizing keeps the selection's aspect ratio, so the result is never distorted.
	readonly resizeHeight = $derived(
		Math.max(1, Math.round((this.edit.resize.width * this.edit.area.height) / this.edit.area.width))
	);
	readonly outputWidth = $derived(
		this.edit.resize.enabled ? this.edit.resize.width : this.cropWidth
	);
	readonly outputHeight = $derived(this.edit.resize.enabled ? this.resizeHeight : this.cropHeight);
	readonly tooLarge = $derived(
		this.outputWidth > MAX_DIMENSION || this.outputHeight > MAX_DIMENSION
	);

	readonly filter = $derived(this.comparing ? 'none' : cssFilter(this.edit.adjustments));
	readonly originalFormat = $derived.by(() => defaultOutputFormat(this.#source.mimeType));
	readonly outputName = $derived.by(() => {
		const { name } = this.#source;

		if (this.edit.format === this.originalFormat) {
			return name;
		}

		const extension = OUTPUT_FORMATS.find((format) => format.value === this.edit.format)?.label;
		const baseName = name.replace(/\.[^.]+$/, '') || 'image';

		return `${baseName}.${extension === 'JPEG' ? 'jpg' : extension?.toLowerCase()}`;
	});

	/** Whether the selection differs from the whole (rotated) image. */
	readonly cropped = $derived.by(() => {
		const { area } = this.edit;

		return (
			area.x > 0.5 ||
			area.y > 0.5 ||
			Math.abs(area.width - this.size.width) > 0.5 ||
			Math.abs(area.height - this.size.height) > 0.5
		);
	});

	constructor(source: ImageEditorSource) {
		this.#source = source;
		this.edit = initialState(source);
		this.#committed = initialState(source);
		this.#pristineJson = JSON.stringify(initialState(source));
	}

	get image() {
		return this.#source.image;
	}

	get mimeType() {
		return this.#source.mimeType;
	}

	aspectRatio(key: string) {
		return aspectRatio(key, this.size);
	}

	#fullArea(): Area {
		return fullArea(this.size, this.aspectRatio(this.edit.aspect));
	}

	/** Records the current state as a step in the history, unless nothing changed. */
	commit = () => {
		const next = $state.snapshot(this.edit);

		if (JSON.stringify(next) === JSON.stringify(this.#committed)) {
			return;
		}

		this.past = [...this.past, this.#committed].slice(-MAX_HISTORY);
		this.future = [];
		this.#committed = next;
	};

	#restore(state: EditorState) {
		this.#committed = state;
		this.edit = structuredClone(state);
	}

	undo = () => {
		const previous = this.past.at(-1);

		if (!previous) {
			return;
		}

		this.future = [this.#committed, ...this.future];
		this.past = this.past.slice(0, -1);
		this.#restore(previous);
	};

	redo = () => {
		const [next, ...rest] = this.future;

		if (!next) {
			return;
		}

		this.past = [...this.past, this.#committed];
		this.future = rest;
		this.#restore(next);
	};

	reset = () => {
		this.edit = initialState(this.#source);
		this.commit();
	};

	rotate(by: 90 | -90) {
		this.edit.rotation = ((((this.edit.rotation + by) % 360) + 360) % 360) as Rotation;
		// The image changed shape; start the selection over.
		this.edit.area = this.#fullArea();
		this.commit();
	}

	flip(axis: 'flipHorizontal' | 'flipVertical') {
		this.edit[axis] = !this.edit[axis];
		this.commit();
	}

	chooseAspect(key: string) {
		this.edit.aspect = key;
		this.edit.area = this.#fullArea();
		this.commit();
	}

	toggleResize(enabled: boolean) {
		this.edit.resize = { enabled, width: this.cropWidth };
		this.commit();
	}

	scaleTo(percent: number) {
		this.edit.resize = {
			enabled: true,
			width: Math.max(1, Math.round((this.cropWidth * percent) / 100))
		};
		this.commit();
	}

	/** Typing a height sets the matching width; the height itself follows from the selection. */
	setResizeHeight(value: number) {
		const { area } = this.edit;

		this.edit.resize.width = Math.max(1, Math.round((value * area.width) / area.height));
	}

	setAdjustment(key: keyof Adjustments, value: number) {
		this.edit.adjustments[key] = value;
		this.commit();
	}

	choosePreset(adjustments: Adjustments) {
		this.edit.adjustments = { ...adjustments };
		this.commit();
	}

	chooseFormat = (format: string) => {
		this.edit.format = format as OutputFormat;
		this.commit();
	};

	/** Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo. */
	handleKeydown = (event: KeyboardEvent) => {
		const target = event.target;

		// Leave undo in text fields to the browser.
		if (target instanceof HTMLInputElement && target.type !== 'checkbox') {
			return;
		}

		if (!(event.ctrlKey || event.metaKey)) {
			return;
		}

		const key = event.key.toLowerCase();

		if (key === 'z' && !event.shiftKey) {
			event.preventDefault();
			this.undo();
		} else if ((key === 'z' && event.shiftKey) || key === 'y') {
			event.preventDefault();
			this.redo();
		}
	};

	/** Holding the compare button (or Space/Enter on it) shows the colors of the original. */
	compareKey(event: KeyboardEvent, down: boolean) {
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();

			if (!event.repeat) {
				this.comparing = down;
			}
		}
	}

	/** Draws the preview (see `drawPreview`); runs again whenever an edit changes. */
	draw(region: Area | null): Attachment<HTMLCanvasElement> {
		return (canvas) => drawPreview(canvas, this.#source.image, this.edit, region);
	}
}
