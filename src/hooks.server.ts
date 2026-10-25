import { sequence } from '@sveltejs/kit/hooks';

import { boot } from './lib/server/hooks/boot';
import { guard } from './lib/server/hooks/guard';
import { session } from './lib/server/hooks/session';
import { theme } from './lib/server/hooks/theme';

export { handleError } from './lib/server/hooks/error';

export const handle = sequence(theme, boot, session, guard);
