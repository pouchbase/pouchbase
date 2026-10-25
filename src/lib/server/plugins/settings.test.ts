import type { PluginSetting } from '@pouchbasejs/plugin-sdk';

import { describe, expect, it } from 'vitest';

import { applySettings, missingSettings, settingsState } from './settings';

const DEFINITION: PluginSetting[] = [
	{ key: 'api_key', label: 'API key', type: 'secret', required: true },
	{ key: 'region', label: 'Region', type: 'text', required: false, default: 'eu' },
	{ key: 'limit', label: 'Limit', type: 'number', required: false, default: 10 },
	{ key: 'debug', label: 'Debug', type: 'boolean', required: false },
	{ key: 'endpoint', label: 'Endpoint', type: 'url', required: true }
];

describe('settingsState', () => {
	it('masks secrets, fills in defaults and lists what is missing', () => {
		expect(settingsState(DEFINITION, { api_key: 'secret', debug: 'true' })).toEqual({
			definition: DEFINITION,
			values: {
				api_key: { value: null, set: true },
				region: { value: 'eu', set: false },
				limit: { value: '10', set: false },
				debug: { value: 'true', set: true },
				endpoint: { value: null, set: false }
			},
			missing: ['endpoint']
		});
	});
});

describe('missingSettings', () => {
	it('lists required settings without a value or a default', () => {
		expect(missingSettings(DEFINITION, {})).toEqual(['api_key', 'endpoint']);
		expect(missingSettings(DEFINITION, { api_key: 'x', endpoint: 'https://a.io' })).toEqual([]);
	});
});

describe('applySettings', () => {
	const saved = { api_key: 'secret', endpoint: 'https://old.example.com', region: 'us' };

	it('keeps values that are undefined and clears null and empty ones', () => {
		expect(applySettings(DEFINITION, saved, { region: null, debug: '' })).toEqual({
			values: { api_key: 'secret', endpoint: 'https://old.example.com' },
			issues: {}
		});
	});

	it('normalises numbers and booleans', () => {
		expect(applySettings(DEFINITION, saved, { limit: ' 42.0 ', debug: 'on' }).values).toMatchObject(
			{ limit: '42', debug: 'true' }
		);
	});

	it('validates each type', () => {
		expect(
			applySettings(DEFINITION, saved, {
				limit: 'many',
				debug: 'maybe',
				endpoint: 'ftp://example.com'
			}).issues
		).toEqual({
			limit: 'Enter a number',
			debug: 'Must be true or false',
			endpoint: 'Enter an absolute URL, e.g. https://example.com'
		});
	});

	it('requires required settings and ignores unknown keys', () => {
		expect(applySettings(DEFINITION, {}, { other: 'x', endpoint: 'https://a.io' })).toEqual({
			values: { endpoint: 'https://a.io' },
			issues: { api_key: 'Required' }
		});
		expect(applySettings(DEFINITION, saved, { api_key: null }).issues).toEqual({
			api_key: 'Required'
		});
	});
});
