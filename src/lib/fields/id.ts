import type { FieldOptions } from './types';

/** How an `id` field generates the key of a new record. */
export const ID_GENERATORS = {
	autoincrement: {
		label: 'Auto-increment',
		description: '1, 2, 3, … stored as an integer. Numbers of deleted records are never reused.'
	},
	uuid: {
		label: 'UUID v4',
		description: 'Random UUID, e.g. 9b2f0c1e-6a4d-4f3b-8e7a-2d5c1b0a9f8e.'
	},
	uuidv7: {
		label: 'UUID v7',
		description: 'UUID that starts with the creation time, so new records sort last.'
	},
	random: {
		label: 'Random string',
		description: '15 lowercase letters and numbers, e.g. k3x9qm2v8tz4np1.'
	}
} as const satisfies Record<string, { label: string; description: string }>;

export type IdGenerator = keyof typeof ID_GENERATORS;

export const ID_GENERATOR_IDS = Object.keys(ID_GENERATORS) as [IdGenerator, ...IdGenerator[]];

/** The generator of an `id` field; fields from before generators existed use random strings. */
export function idGenerator(options: FieldOptions): IdGenerator {
	return options.generator ?? 'random';
}
