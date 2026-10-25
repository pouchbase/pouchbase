<script lang="ts">
	// The icons are registered by the host: it imports `virtual:iconify` (from the
	// `@pouchbasejs/ui/vite` plugin) once, so icons render on the server too.
	import Icon from '@iconify/svelte';

	type Props = {
		/**
		 * Iconify name, e.g. `lucide:plus`. Literal strings only, so the build can find them. Shown
		 * when there is no `src`.
		 */
		icon?: string;
		/**
		 * URL of an SVG image, e.g. a plugin's icon of a field type: drawn in the text color
		 * (`currentColor`) at the size of the Iconify icons, so only its shape counts. Wins over `icon`.
		 */
		src?: string | null;
		/** Accessible label. Without one the icon is decorative and hidden from assistive technology. */
		label?: string;
		class?: string;
	};

	let { icon, src, label, class: className }: Props = $props();

	const classes = $derived(['shrink-0', className].filter(Boolean).join(' '));

	// The image is a mask over the text color, like the strokes of an Iconify icon in `currentColor`.
	const mask = $derived(
		src
			? `url("${src.replace(/["\\\n\r]/g, (char) => encodeURIComponent(char))}") center / contain no-repeat`
			: undefined
	);
</script>

{#if mask}
	<!-- An <svg> like the Iconify icons, so it takes the same size, alignment and styles. -->
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="1em"
		height="1em"
		role={label ? 'img' : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
		class={classes}
		style:background-color="currentColor"
		style:-webkit-mask={mask}
		style:mask
	></svg>
{:else if icon}
	<Icon
		{icon}
		role={label ? 'img' : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
		class={classes}
	/>
{/if}
