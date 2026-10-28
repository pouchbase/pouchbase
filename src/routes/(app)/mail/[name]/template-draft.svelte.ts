import type { Width } from '#lib/components/ui/email-preview/index.js';
import type { MailStyle } from '#lib/mail/layout.js';
import type { MailEditor, MailTemplateContent } from '#lib/mail/mail-templates.js';
import { compileTemplate, missingVariables } from '#lib/mail/mail-templates.js';
import type { Variables } from '#lib/mail/template.js';
import type { MailTemplate } from '../types';

function json(value: Variables) {
	return JSON.stringify(value, null, '\t');
}

/**
 * The unsaved state of the template editor. It starts from the saved template; the page creates
 * it again after a save or reset.
 */
export class TemplateDraft {
	readonly saved: {
		subject: string;
		preheader: string;
		editor: MailEditor;
		body: string;
		style: MailStyle;
		description: string;
		sampleData: string;
	};

	subject = $state('');
	preheader = $state('');
	editor = $state<MailEditor>('visual');
	body = $state('');
	// Set in the constructor, like the other fields.
	style = $state<MailStyle>(undefined!);
	description = $state('');
	sampleText = $state('');

	tab = $state('design');
	width = $state<Width>('desktop');
	failure = $state<string | null>(null);

	/** The body as the visual editor writes it, so loading it doesn't count as a change. */
	savedBody = $state('');

	content = $derived<MailTemplateContent>({
		subject: this.subject,
		preheader: this.preheader,
		editor: this.editor,
		body: this.body,
		style: this.style
	});

	changed = $derived.by(
		() =>
			this.subject !== this.saved.subject ||
			this.preheader !== this.saved.preheader ||
			this.editor !== this.saved.editor ||
			this.body !== this.savedBody ||
			JSON.stringify(this.style) !== JSON.stringify(this.saved.style) ||
			this.description !== this.saved.description ||
			this.sampleText !== this.saved.sampleData
	);

	sample = $derived.by((): { ok: true; value: Variables } | { ok: false } => {
		try {
			const value: unknown = JSON.parse(this.sampleText || '{}');

			return value && typeof value === 'object' && !Array.isArray(value)
				? { ok: true, value: value as Variables }
				: { ok: false };
		} catch {
			return { ok: false };
		}
	});

	sampleData = $derived(this.sample.ok ? this.sample.value : {});
	compiled = $derived(compileTemplate(this.content));
	missing = $derived(
		this.compiled.ok ? missingVariables(this.compiled.variables, this.sampleData) : []
	);
	rendered = $derived(this.compiled.ok ? this.compiled.render(this.sampleData) : null);

	/** Names for "Insert variable": what the template uses and what the sample data has. */
	variableNames = $derived(
		[
			...(this.compiled.ok ? this.compiled.variables.map((v) => v.name) : []),
			...Object.keys(this.sampleData)
		].filter((name, index, names) => names.indexOf(name) === index)
	);

	constructor(template: MailTemplate) {
		this.saved = {
			subject: template.content.subject,
			preheader: template.content.preheader,
			editor: template.content.editor,
			body: template.content.body,
			style: template.content.style,
			description: template.description,
			sampleData: json(template.sampleData)
		};

		this.subject = this.saved.subject;
		this.preheader = this.saved.preheader;
		this.editor = this.saved.editor;
		this.body = this.saved.body;
		this.style = this.saved.style;
		this.description = this.saved.description;
		this.sampleText = this.saved.sampleData;
		this.savedBody = this.saved.body;
	}

	discard() {
		this.subject = this.saved.subject;
		this.preheader = this.saved.preheader;
		this.editor = this.saved.editor;
		this.body = this.savedBody;
		this.style = this.saved.style;
		this.description = this.saved.description;
		this.sampleText = this.saved.sampleData;
		this.failure = null;
	}
}
