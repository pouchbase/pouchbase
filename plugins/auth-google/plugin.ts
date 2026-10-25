import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import google from './auth/google/provider.js';

export default definePlugin({
	authProviders: { google }
});
