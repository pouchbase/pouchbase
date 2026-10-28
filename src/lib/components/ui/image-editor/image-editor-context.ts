import { createContext } from 'svelte';
import type { ImageEditorState } from './image-editor-state.svelte.js';

export const [getImageEditorContext, setImageEditorContext] = createContext<ImageEditorState>();
