import type { Attachment } from 'svelte/attachments';

/**
 * Grows a textarea with its text, like the title and code blocks of the WordPress editor. Read
 * `value` in the attachment's expression (`{@attach autosize(value)}`), so it also runs when the
 * text changes from outside.
 */
export function autosize(value: unknown): Attachment<HTMLTextAreaElement> {
	void value;

	return (textarea) => {
		function fit() {
			textarea.style.height = 'auto';
			textarea.style.height = `${textarea.scrollHeight}px`;
		}

		fit();

		const observer = new ResizeObserver(fit);

		observer.observe(textarea);
		textarea.addEventListener('input', fit);

		return () => {
			observer.disconnect();
			textarea.removeEventListener('input', fit);
		};
	};
}
