import { ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { requireUser } from '@/modules/auth/session';
import { toPublicUser } from '@/modules/users/user.model';

/** GET /api/auth/me — the signed-in user, or 401 when there is no valid session. */
export const GET = withRoute(async (request) => ok(toPublicUser(await requireUser(request))));
