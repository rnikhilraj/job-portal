import { buildPaginationMeta, ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { searchParamsToObject } from '@/lib/validation';
import { requireRole } from '@/modules/auth/session';
import { candidateSearchQuerySchema } from '@/modules/users/user.schema';
import { searchCandidates } from '@/modules/users/user.service';

/**
 * GET /api/candidates — HR-only search over candidates who have opted in.
 *
 * The opt-in filter is not applied here; it lives in searchCandidates() so it
 * holds for every caller of the service, including the page that renders these
 * results server-side.
 */
export const GET = withRoute(async (request) => {
  await requireRole(request, 'HR');

  const query = candidateSearchQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams),
  );
  const { candidates, total } = await searchCandidates(query);

  return ok(candidates, buildPaginationMeta(query.page, query.limit, total));
});
