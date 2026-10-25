import { snippet } from '#lib/highlight.js';

export const variables = snippet(
	'html',
	`
<h1>Welcome, {{ name | there }}!</h1>

{{#if trial}}
	<p>Your trial ends on {{ trial.endsOn }}.</p>
{{else}}
	<p>Thanks for subscribing.</p>
{{/if}}

<ul>
	{{#each items}}
		<li>{{ @number }}. {{ title }} ({{ currency | EUR }})</li>
	{{/each}}
</ul>`
);
