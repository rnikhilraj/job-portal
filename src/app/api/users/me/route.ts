import { ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { requireUser } from '@/modules/auth/session';
import { toPublicUser } from '@/modules/users/user.model';
import { updateProfileSchema } from '@/modules/users/user.schema';
import { updateProfile } from '@/modules/users/user.service';

/** GET /api/users/me — the caller's own profile. */
export const GET = withRoute(async (request) => ok(toPublicUser(await requireUser(request))));

/**
 * PATCH /api/users/me — edit the caller's own profile.
 *
 * There is deliberately no route for editing another user, and the target is
 * always the id from the verified session.
 */
export const PATCH = withRoute(async (request) => {
  const user = await requireUser(request);
  const input = updateProfileSchema.parse(await request.json());

  return ok(await updateProfile(String(user._id), input));
});
