import type { Editor } from '@tiptap/core';

/** A toggle button in the toolbar. */
export type Tool = {
	label: string;
	icon: string;
	active?: () => boolean;
	run: (e: Editor) => void;
};

/** Whether a mark or node (or attributes, e.g. `{ textAlign: 'left' }`) is active at the selection. */
export type IsActive = (
	name: string | Record<string, unknown>,
	attributes?: Record<string, unknown>
) => boolean;

export const BLOCK_STYLES = [
	{ value: 'paragraph', label: 'Text' },
	{ value: 'h1', label: 'Heading 1' },
	{ value: 'h2', label: 'Heading 2' },
	{ value: 'h3', label: 'Heading 3' }
];

export const FONT_SIZES = [
	{ value: 'default', label: 'Normal size' },
	{ value: '13px', label: 'Small' },
	{ value: '18px', label: 'Large' },
	{ value: '22px', label: 'Extra large' }
];

/** The toolbar's groups of toggle buttons: marks, alignments and lists. */
export function formattingTools(active: IsActive, editLink: () => Promise<void>) {
	const marks: Tool[] = [
		{
			label: 'Bold',
			icon: 'lucide:bold',
			active: () => active('bold'),
			run: (e) => e.chain().focus().toggleBold().run()
		},
		{
			label: 'Italic',
			icon: 'lucide:italic',
			active: () => active('italic'),
			run: (e) => e.chain().focus().toggleItalic().run()
		},
		{
			label: 'Underline',
			icon: 'lucide:underline',
			active: () => active('underline'),
			run: (e) => e.chain().focus().toggleUnderline().run()
		},
		{
			label: 'Strikethrough',
			icon: 'lucide:strikethrough',
			active: () => active('strike'),
			run: (e) => e.chain().focus().toggleStrike().run()
		},
		{
			label: 'Link',
			icon: 'lucide:link',
			active: () => active('link'),
			run: () => void editLink()
		}
	];

	const alignments: Tool[] = [
		{
			label: 'Align left',
			icon: 'lucide:align-left',
			active: () => active({ textAlign: 'left' }),
			run: (e) => e.chain().focus().setTextAlign('left').run()
		},
		{
			label: 'Align center',
			icon: 'lucide:align-center',
			active: () => active({ textAlign: 'center' }),
			run: (e) => e.chain().focus().setTextAlign('center').run()
		},
		{
			label: 'Align right',
			icon: 'lucide:align-right',
			active: () => active({ textAlign: 'right' }),
			run: (e) => e.chain().focus().setTextAlign('right').run()
		}
	];

	const lists: Tool[] = [
		{
			label: 'Bullet list',
			icon: 'lucide:list',
			active: () => active('bulletList'),
			run: (e) => e.chain().focus().toggleBulletList().run()
		},
		{
			label: 'Numbered list',
			icon: 'lucide:list-ordered',
			active: () => active('orderedList'),
			run: (e) => e.chain().focus().toggleOrderedList().run()
		},
		{
			label: 'Quote',
			icon: 'lucide:quote',
			active: () => active('blockquote'),
			run: (e) => e.chain().focus().toggleBlockquote().run()
		}
	];

	return { marks, alignments, lists };
}
