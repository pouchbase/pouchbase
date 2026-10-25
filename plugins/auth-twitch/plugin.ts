import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import twitch from './auth/twitch/provider.js';

export default definePlugin({
	authProviders: { twitch }
});
