import { ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { objectIdSchema } from '@/lib/validation';
import { requireRole } from '@/modules/auth/session';
import { findDiscoverableCandidate } from '@/modules/users/user.service';

/**
 * GET /api/candidates/:id — one opted-in candidate's recruiter-visible profile.
 *
 * The opt-in is re-checked by findDiscoverableCandidate() on every request, so
 * a stale id for someone who has since opted out returns 404 rather than a
 * cached view of their details.
 */
export const GET = withRoute<{ id: string }>(async (request, params) => {
  const candidateId = objectIdSchema.parse(params.id);
  await requireRole(request, 'HR');

  return ok(await findDiscoverableCandidate(candidateId));
});
