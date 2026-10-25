import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import github from './auth/github/provider.js';

export default definePlugin({
	authProviders: { github }
});
