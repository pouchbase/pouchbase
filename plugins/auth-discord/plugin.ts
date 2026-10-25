import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import discord from './auth/discord/provider.js';

export default definePlugin({
	authProviders: { discord }
});
