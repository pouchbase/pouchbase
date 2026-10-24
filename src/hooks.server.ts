import { sequence } from '@sveltejs/kit/hooks';

import { boot } from './lib/server/hooks/boot';
import { guard } from './lib/server/hooks/guard';
import { session } from './lib/server/hooks/session';

export { handleError } from './lib/server/hooks/error';

export const handle = sequence(boot, session, guard);
