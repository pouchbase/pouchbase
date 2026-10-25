import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import microsoft from './auth/microsoft/provider.js';

export default definePlugin({
	authProviders: { microsoft }
});
