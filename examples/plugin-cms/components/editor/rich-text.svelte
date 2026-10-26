<script lang="ts">
	import type { Attachment } from 'svelte/attachments';

	type Props = {
		/** The element that is edited: `p`, `h2`, `ul`, `blockquote`, … */
		tag: string;
		/** Its inline HTML (`<li>` items for a list); kept in sync both ways. */
		html: string;
		placeholder?: string;
		element?: HTMLElement | null;
		oninput?: (html: string) => void;
		class?: string | (string | false | undefined)[];
	};

	let {
		tag,
		html = $bindable(),
		placeholder,
		element = $bindable(null),
		oninput,
		class: className
	}: Props = $props();

	// A block whose text was deleted keeps a stray <br> (or an empty <li> in a list): that is empty.
	function clean(value: string) {
		return /^\s*(<br\s*\/?>|<li>(<br\s*\/?>)?<\/li>)?\s*$/i.test(value) ? '' : value;
	}

	// The element has no Svelte children, so its content is ours. Changes from outside (a merge, a
	// new type, loading a post) reach it here; typing doesn't round-trip, so the caret stays put.
	const sync: Attachment<HTMLElement> = (node) => {
		element = node;

		if (clean(node.innerHTML) !== html) {
			node.innerHTML = tag === 'ul' || tag === 'ol' ? html || '<li></li>' : html;
		}
	};

	function handleInput() {
		if (!element) {
			return;
		}

		html = clean(element.innerHTML);
		oninput?.(html);
	}

	// Pasted text comes in as plain text, so no styles or scripts from elsewhere get in.
	function handlePaste(event: ClipboardEvent) {
		const text = event.clipboardData?.getData('text/plain');

		if (text === undefined) {
			return;
		}

		event.preventDefault();
		document.execCommand('insertText', false, text);
	}
</script>

<svelte:element
	this={tag}
	{@attach sync}
	contenteditable="true"
	role="textbox"
	tabindex="0"
	aria-multiline="true"
	aria-label={placeholder}
	data-editable=""
	data-placeholder={placeholder}
	data-empty={html === '' ? '' : undefined}
	oninput={handleInput}
	onpaste={handlePaste}
	class={[
		'relative outline-none',
		'data-empty:before:pointer-events-none data-empty:before:absolute data-empty:before:text-zinc-400 data-empty:before:content-[attr(data-placeholder)]',
		className
	]}
></svelte:element>
