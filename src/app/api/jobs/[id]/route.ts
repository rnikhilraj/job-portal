import { noContent, ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { objectIdSchema } from '@/lib/validation';
import { requireRole, requireUser } from '@/modules/auth/session';
import { updateJobSchema } from '@/modules/jobs/job.schema';
import { deleteJob, findJobForViewer, updateJob } from '@/modules/jobs/job.service';

/** GET /api/jobs/:id — open listings for anyone signed in, plus the owner's own. */
export const GET = withRoute<{ id: string }>(async (request, params) => {
  const jobId = objectIdSchema.parse(params.id);
  const user = await requireUser(request);

  return ok(await findJobForViewer(jobId, { id: user._id, role: user.role }));
});

/** PATCH /api/jobs/:id — owner HR only. */
export const PATCH = withRoute<{ id: string }>(async (request, params) => {
  const jobId = objectIdSchema.parse(params.id);
  const hr = await requireRole(request, 'HR');
  const input = updateJobSchema.parse(await request.json());

  return ok(await updateJob(jobId, hr._id, input));
});

/** DELETE /api/jobs/:id — owner HR only. */
export const DELETE = withRoute<{ id: string }>(async (request, params) => {
  const jobId = objectIdSchema.parse(params.id);
  const hr = await requireRole(request, 'HR');
  await deleteJob(jobId, hr._id);

  return noContent();
});
