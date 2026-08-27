import { buildPaginationMeta, ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { searchParamsToObject } from '@/lib/validation';
import { requireRole } from '@/modules/auth/session';
import { myApplicationsQuerySchema } from '@/modules/applications/application.schema';
import { listApplicationsForCandidate } from '@/modules/applications/application.service';

/** GET /api/applications — the signed-in candidate's own applications. */
export const GET = withRoute(async (request) => {
  const candidate = await requireRole(request, 'CANDIDATE');
  const query = myApplicationsQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams),
  );

  const { applications, total } = await listApplicationsForCandidate(candidate._id, query);

  return ok(applications, buildPaginationMeta(query.page, query.limit, total));
});
