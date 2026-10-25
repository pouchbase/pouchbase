import { describe, expect, expectTypeOf, it } from 'vitest';

import plugin from '../plugin.js';
import { fakeContext } from './context.js';

describe('settings', () => {
	it('come from plugin.ts', () => {
		expect(plugin.settings.map((setting) => setting.key)).toEqual([
			'greeting',
			'max_length',
			'shout'
		]);
	});

	it('are typed by the Register block in plugin.ts', async () => {
		const { ctx } = fakeContext();

		// Every setting has a default, so none is ever null; a number or boolean setting is parsed.
		expectTypeOf(ctx.settings.get('greeting')).resolves.toEqualTypeOf<string>();
		expectTypeOf(ctx.settings.get('max_length')).resolves.toEqualTypeOf<number>();
		expectTypeOf(ctx.settings.get('shout')).resolves.toEqualTypeOf<boolean>();
		expectTypeOf(ctx.settings.getAll()).resolves.toEqualTypeOf<{
			greeting: string;
			max_length: number;
			shout: boolean;
		}>();
		expect(await ctx.settings.getAll()).toEqual({
			greeting: 'Hello',
			max_length: 280,
			shout: false
		});

		// A key that plugin.ts doesn't declare is a type error (checked by `pnpm check`).
		// @ts-expect-error: `greting` is not a setting
		expect(await ctx.settings.get('greting')).toBeNull();
	});
});
