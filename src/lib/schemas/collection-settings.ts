import { z } from 'zod';

import { parseThumbnailSize, splitThumbnailSizes } from '#lib/files/thumbnails.js';
import { MAX_FILTER_LENGTH } from '#lib/filter/filter.js';
import { API_RULE_ACTIONS } from '#lib/filter/rules.js';

import { ruleSyntaxIssue } from './collections';

export const thumbnailSettingsSchema = z
	.object({
		/** Collection name, sent as a hidden field. */
		collection: z.string(),
		enabled: z.boolean().default(false),
		/** Thumbnail sizes (`WxH`, `WxHt`, ...), separated by commas or new lines. */
		sizes: z.string().max(2000)
	})
	.superRefine((data, ctx) => {
		const invalid = splitThumbnailSizes(data.sizes).filter((spec) => !parseThumbnailSize(spec));

		if (invalid.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['sizes'],
				message: `Not a valid size: ${invalid.join(', ')}. Use e.g. 100x100, 300x0, 0x200 or 800x600f.`
			});
		}

		if (data.enabled && !splitThumbnailSizes(data.sizes).length) {
			ctx.addIssue({ code: 'custom', path: ['sizes'], message: 'Add at least one size' });
		}
	});

const ruleSchema = z.string().max(MAX_FILTER_LENGTH).default('');
const lockedSchema = z.boolean().default(false);

/**
 * API rules of a collection: per action a rule and whether it is locked (admins only). Only the
 * syntax is checked here; the server also checks the field names.
 */
export const apiRulesSchema = z
	.object({
		/** Collection name, sent as a hidden field. */
		collection: z.string(),
		list: ruleSchema,
		listLocked: lockedSchema,
		view: ruleSchema,
		viewLocked: lockedSchema,
		create: ruleSchema,
		createLocked: lockedSchema,
		update: ruleSchema,
		updateLocked: lockedSchema,
		delete: ruleSchema,
		deleteLocked: lockedSchema
	})
	.superRefine((data, ctx) => {
		for (const action of API_RULE_ACTIONS) {
			const rule = data[action].trim();

			if (data[`${action}Locked`] || !rule) {
				continue;
			}

			const message = ruleSyntaxIssue(rule);

			if (message) {
				ctx.addIssue({ code: 'custom', path: [action], message });
			}
		}
	});
