import type { PlanStep } from '#lib/environments/diff.js';
import type { SnapshotField } from '#lib/schemas/environments.js';
import type { FieldChange } from '../fields.service';
import type { Services } from '../services';

import { eq } from 'drizzle-orm';

import { db, fields } from '../../db';
import { describeError, StepError, stepResult } from '../../jobs';

/**
 * Runs one step of a plan through the services, as if it was made in the UI. A step that already
 * happened (tried again after a timeout) is skipped. Throws a `StepError` with what went wrong.
 */
export async function applyStep(services: Services, step: PlanStep) {
	switch (step.kind) {
		case 'collection.create': {
			if (!(await collection(services, step.collectionId))) {
				await stepResult(services.collections().create(step.collection, step.collectionId));
			}

			return;
		}

		case 'collection.rename': {
			const target = await requireCollection(services, step.collectionId, step.from);

			if (target.name !== step.to) {
				await stepResult(services.collections().rename(target.name, step.to));
			}

			return;
		}

		case 'collection.delete': {
			const target = await collection(services, step.collectionId);

			if (target) {
				await stepResult(services.collections().delete(target.name));
			}

			return;
		}

		case 'collection.settings': {
			const target = await requireCollection(services, step.collectionId, step.collection);

			await stepResult(
				services.collections().updateSettings(target.name, {
					thumbnails: step.settings.thumbnails,
					rules: step.settings.rules
				})
			);

			return;
		}

		case 'collection.order': {
			const target = await requireCollection(services, step.collectionId, step.collection);
			const changes = await fieldChanges(services, target.id, step.fieldIds);

			await stepResult(services.fields().updateAll(target.name, changes));

			return;
		}

		case 'field.create': {
			const target = await requireCollection(services, step.collectionId, step.collection);

			if (!(await field(step.field.id))) {
				await createField(services, target.name, step.field);
			}

			return;
		}

		case 'field.update':
			return updateField(services, step);

		case 'field.delete': {
			const [target, existing] = await Promise.all([
				collection(services, step.collectionId),
				field(step.fieldId)
			]);

			if (target && existing) {
				await stepResult(services.fields().delete(target.name, existing.name));
			}

			return;
		}

		case 'index.create': {
			const target = await requireCollection(services, step.collectionId, step.collection);
			const existing = await stepResult(services.indexes().list(target.name));
			const exists = existing.some(
				(index) =>
					!index.managedBy &&
					index.unique === step.unique &&
					index.columns.join(',') === step.columns.join(',')
			);

			if (!exists) {
				await stepResult(
					services.indexes().create(target.name, { columns: step.columns, unique: step.unique })
				);
			}

			return;
		}

		case 'index.drop': {
			const target = await requireCollection(services, step.collectionId, step.collection);
			const result = await services.indexes().delete(target.name, step.name);

			// 9004: the index is already gone.
			if (result.isErr() && result.error.code !== 9004) {
				throw new StepError(describeError(result.error));
			}

			return;
		}

		case 'function.create':
		case 'function.update':
			return upsertFunction(services, step.fn);

		case 'function.delete': {
			const fn = await stepResult(services.functions().get(step.name));

			if (fn) {
				await stepResult(services.functions().delete(fn.id));
			}

			return;
		}

		case 'plugin.install':
			await stepResult(services.plugins().install(step.plugin.id, step.plugin.version));

			return;

		case 'plugin.remove':
			await stepResult(services.plugins().uninstall(step.id));

			return;

		case 'setting.set':
			await stepResult(services.settings().set(step.key, step.to));

			return;

		case 'oauth.update': {
			const current = await stepResult(services.oauthProviders().credentials(step.provider));

			// No plugin on this instance contributes the provider (the plan warned about it).
			if (!current) {
				console.warn(`[environments] Skipping sign-in with ${step.provider}: no plugin has it`);

				return;
			}

			// The secret is never published: without one on this instance, the provider stays off.
			await stepResult(
				services.oauthProviders().update(step.provider, {
					enabled: step.enabled && !!current.clientSecret,
					clientId: step.clientId
				})
			);

			return;
		}
	}
}

async function updateField(services: Services, step: Extract<PlanStep, { kind: 'field.update' }>) {
	const target = await requireCollection(services, step.collectionId, step.collection);
	const existing = await field(step.field.id);

	if (step.changes.includes('type')) {
		// SQLite can't convert a column: it is dropped and created again, with the same id.
		if (existing && existing.type !== step.field.type) {
			await stepResult(services.fields().delete(target.name, existing.name));
		}

		if (!existing || existing.type !== step.field.type) {
			await createField(services, target.name, step.field);
		}

		return;
	}

	if (!existing) {
		throw new StepError(`Field ${step.from} not found in ${target.name}`);
	}

	if (step.changes.some((change) => ['name', 'required', 'unique', 'hidden'].includes(change))) {
		const changes = (await fieldChanges(services, target.id)).map((change) =>
			change.id === existing.id
				? {
						...change,
						name: step.field.name,
						required: step.field.required,
						unique: step.field.unique,
						hidden: step.field.hidden
					}
				: change
		);

		await stepResult(services.fields().updateAll(target.name, changes));
	}

	if (step.changes.includes('defaultValue') || step.changes.includes('options')) {
		await stepResult(
			step.field.type === 'computed'
				? services.fields().updateComputed(target.name, step.field.name, step.field.options)
				: services.fields().update(target.name, step.field.name, {
						defaultValue: step.field.defaultValue ?? undefined,
						options: step.field.options
					})
		);
	}
}

async function upsertFunction(
	services: Services,
	fn: Extract<PlanStep, { kind: 'function.create' }>['fn']
) {
	let existing = await stepResult(services.functions().get(fn.name));

	if (!existing) {
		const created = await stepResult(
			services.functions().create({
				name: fn.name,
				description: fn.description,
				requireAuth: fn.requireAuth,
				language: fn.code?.language ?? 'typescript'
			})
		);

		// Created with the starter code: the published code is deployed below.
		existing = { ...created, source: '' };
	} else if (existing.description !== fn.description || existing.requireAuth !== fn.requireAuth) {
		await stepResult(
			services
				.functions()
				.update(existing.id, { description: fn.description, requireAuth: fn.requireAuth })
		);
	}

	if (fn.code && (fn.code.source !== existing.source || fn.code.language !== existing.language)) {
		await stepResult(
			services.functions().deploy(existing.id, {
				language: fn.code.language,
				source: fn.code.source,
				compiled: fn.code.compiled ?? undefined
			})
		);
	}
}

/** The collection by id: names change during a plan, ids don't. */
function collection(services: Services, id: string) {
	return stepResult(services.collections().getById(id));
}

async function requireCollection(services: Services, id: string, name: string) {
	return (await collection(services, id)) ?? raise(`Collection ${name} not found`);
}

function raise(message: string): never {
	throw new StepError(message);
}

async function field(id: string) {
	const [row] = await db.select().from(fields).where(eq(fields.id, id));

	return row ?? null;
}

/** Every field of the collection as `updateAll` takes them, in `order` (others after them). */
async function fieldChanges(
	services: Services,
	collectionId: string,
	order: string[] = []
): Promise<FieldChange[]> {
	const current = await stepResult(services.fields().list(collectionId));
	const rank = (id: string) => {
		const index = order.indexOf(id);

		return index === -1 ? order.length : index;
	};

	return [...current]
		.sort((a, b) => rank(a.id) - rank(b.id))
		.map((field) => ({
			id: field.id,
			name: field.name,
			required: field.required,
			unique: field.unique,
			hidden: field.hidden,
			remove: false
		}));
}

function createField(services: Services, collectionName: string, field: SnapshotField) {
	return stepResult(
		services.fields().create(collectionName, {
			id: field.id,
			name: field.name,
			type: field.type,
			required: field.required,
			unique: field.unique,
			hidden: field.hidden,
			defaultValue: field.defaultValue ?? undefined,
			options: field.options,
			system: field.system
		})
	);
}
