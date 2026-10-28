import type { Field, FieldChange } from '../services/fields.service';

import { canHide, isAutoType, isMultiple, isValidFieldName } from '#lib/fields/field-types.js';

import { Failure } from '../failure';

/**
 * The edit collection sheet saves every field at once (`FieldsService.updateAll`); this plans what
 * that means per field, before anything is changed.
 */

/** A field as it will be after the save. */
export type PlannedField = {
	field: Field;
	name: string;
	required: boolean;
	unique: boolean;
	hidden: boolean;
	remove: boolean;
};

/**
 * What the changes do to each field: the listed fields in their order, then the others. System
 * fields can only be moved. Throws `INVALID_FIELD_NAME` (7001) or `FIELD_ALREADY_EXISTS` (7002),
 * with the field's id as `data.id`, and `FIELD_IN_USE` (7012) when a computed field that stays
 * loses the field it is calculated from.
 */
export function planFieldChanges(
	current: Field[],
	changes: FieldChange[]
): { kept: PlannedField[]; removed: PlannedField[] } {
	const byId = new Map(current.map((field) => [field.id, field]));
	const listed = changes.filter((change) => byId.has(change.id));
	const listedIds = new Set(listed.map((change) => change.id));

	const planned = [
		...listed,
		...current
			.filter((field) => !listedIds.has(field.id))
			.map((field) => ({ ...field, remove: false }))
	].map((change): PlannedField => {
		const field = byId.get(change.id)!;

		if (field.system) {
			return {
				field,
				name: field.name,
				required: field.required,
				unique: field.unique,
				hidden: field.hidden,
				remove: false
			};
		}

		// Same rules as `FieldsService.create`.
		const auto = isAutoType(field.type);

		return {
			field,
			name: change.name,
			required: change.required && field.type !== 'computed' && !auto,
			unique: change.unique && !isMultiple(field) && field.type !== 'file' && !auto,
			hidden: canHide(field) && (change.hidden ?? field.hidden),
			remove: change.remove
		};
	});

	const kept = planned.filter((plan) => !plan.remove);
	const removed = planned.filter((plan) => plan.remove);
	const names = new Set<string>();

	for (const plan of kept) {
		if (plan.name !== plan.field.name && !isValidFieldName(plan.name)) {
			throw new Failure({ code: 7001, message: 'INVALID_FIELD_NAME', data: { id: plan.field.id } });
		}

		if (names.has(plan.name)) {
			throw new Failure({
				code: 7002,
				message: 'FIELD_ALREADY_EXISTS',
				data: { id: plan.field.id }
			});
		}

		names.add(plan.name);
	}

	// Computed fields that stay can't lose their source.
	const removedNames = new Set(removed.map((plan) => plan.field.name));
	const computed = kept
		.filter(
			(plan) => plan.field.type === 'computed' && removedNames.has(plan.field.options.source ?? '')
		)
		.map((plan) => plan.field.name);

	if (computed.length) {
		throw new Failure({ code: 7012, message: 'FIELD_IN_USE', data: { computed } });
	}

	return { kept, removed };
}
