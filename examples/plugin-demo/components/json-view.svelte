<script lang="ts">
	let { value }: { value: unknown } = $props();

	type Kind = 'key' | 'string' | 'number' | 'literal' | 'plain';

	// Strings (a key when a colon follows), numbers, and true, false and null; the rest is plain.
	const TOKEN =
		/("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

	const tokens = $derived.by(() => {
		const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
		const list: { text: string; kind: Kind }[] = [];
		let last = 0;

		for (const match of text.matchAll(TOKEN)) {
			if (match.index > last) {
				list.push({ text: text.slice(last, match.index), kind: 'plain' });
			}

			if (match[1] !== undefined) {
				list.push({ text: match[1], kind: match[2] ? 'key' : 'string' });

				if (match[2]) {
					list.push({ text: match[2], kind: 'plain' });
				}
			} else {
				list.push({ text: match[0], kind: /^[-\d]/.test(match[0]) ? 'number' : 'literal' });
			}

			last = match.index + match[0].length;
		}

		list.push({ text: text.slice(last), kind: 'plain' });

		return list;
	});

	const colors: Record<Kind, string> = {
		key: 'text-sky-300',
		string: 'text-emerald-300',
		number: 'text-amber-300',
		literal: 'text-violet-300',
		plain: 'text-zinc-400'
	};
</script>

<pre
	class="max-h-80 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs/relaxed shadow-inner"><code
		>{#each tokens as token, index (index)}<span class={colors[token.kind]}>{token.text}</span
			>{/each}</code
	></pre>
