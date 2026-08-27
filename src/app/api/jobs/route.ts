import { z } from 'zod';

import { buildPaginationMeta, created, ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { searchParamsToObject } from '@/lib/validation';
import { requireRole, requireUser } from '@/modules/auth/session';
import {
  browseJobsQuerySchema,
  createJobSchema,
  hrJobsQuerySchema,
} from '@/modules/jobs/job.schema';
import { browseJobs, createJob, listJobsForOwner } from '@/modules/jobs/job.service';

/**
 * `scope=open` (the default) is the candidate-facing search over open listings.
 * `scope=mine` returns the caller's own listings including closed ones, and is
 * restricted to HR accounts.
 */
const scopeSchema = z.enum(['open', 'mine']).default('open');

/** GET /api/jobs — browse open listings, or an HR user's own listings. */
export const GET = withRoute(async (request) => {
  const rawQuery = searchParamsToObject(request.nextUrl.searchParams);
  const scope = scopeSchema.parse(rawQuery.scope);

  if (scope === 'mine') {
    const hr = await requireRole(request, 'HR');
    const query = hrJobsQuerySchema.parse(rawQuery);
    const { jobs, total } = await listJobsForOwner(hr._id, query);
    return ok(jobs, buildPaginationMeta(query.page, query.limit, total));
  }

  await requireUser(request);
  const query = browseJobsQuerySchema.parse(rawQuery);
  const { jobs, total } = await browseJobs(query);
  return ok(jobs, buildPaginationMeta(query.page, query.limit, total));
});

/** POST /api/jobs — HR only. */
export const POST = withRoute(async (request) => {
  const hr = await requireRole(request, 'HR');
  const input = createJobSchema.parse(await request.json());

  return created(await createJob(input, hr._id));
});
