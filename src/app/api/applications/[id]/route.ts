import { ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { objectIdSchema } from '@/lib/validation';
import { requireRole } from '@/modules/auth/session';
import { updateApplicationStatusSchema } from '@/modules/applications/application.schema';
import { updateApplicationStatus } from '@/modules/applications/application.service';

/** PATCH /api/applications/:id — status change, restricted to the owning HR user. */
export const PATCH = withRoute<{ id: string }>(async (request, params) => {
  const applicationId = objectIdSchema.parse(params.id);
  const hr = await requireRole(request, 'HR');
  const { status } = updateApplicationStatusSchema.parse(await request.json());

  return ok(await updateApplicationStatus(applicationId, hr._id, status));
});
