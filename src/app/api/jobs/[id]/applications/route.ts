import { BadRequestError } from '@/lib/api/errors';
import { buildPaginationMeta, created, ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import { assertContentLengthWithinLimit } from '@/lib/resume-storage';
import { objectIdSchema, searchParamsToObject } from '@/lib/validation';
import { requireRole } from '@/modules/auth/session';
import {
  applicantsQuerySchema,
  applyToJobSchema,
} from '@/modules/applications/application.schema';
import { applyToJob, listApplicantsForJob } from '@/modules/applications/application.service';

/** GET /api/jobs/:id/applications — applicants for a listing, owner HR only. */
export const GET = withRoute<{ id: string }>(async (request, params) => {
  const jobId = objectIdSchema.parse(params.id);
  const hr = await requireRole(request, 'HR');
  const query = applicantsQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));

  const { applicants, total } = await listApplicantsForJob(jobId, hr._id, query);

  return ok(applicants, buildPaginationMeta(query.page, query.limit, total));
});

/** POST /api/jobs/:id/applications — candidate applies with a PDF resume. */
export const POST = withRoute<{ id: string }>(async (request, params) => {
  const jobId = objectIdSchema.parse(params.id);
  const candidate = await requireRole(request, 'CANDIDATE');

  // Checked before parsing the body so an oversized upload is rejected without
  // being buffered into memory first.
  assertContentLengthWithinLimit(request.headers.get('content-length'));

  const formData = await request.formData().catch(() => {
    throw new BadRequestError('Expected a multipart form submission.');
  });

  const file = formData.get('resume');
  if (!(file instanceof File)) {
    throw new BadRequestError('A PDF resume is required.');
  }

  const coverNoteValue = formData.get('coverNote');
  const { coverNote } = applyToJobSchema.parse({
    coverNote: typeof coverNoteValue === 'string' ? coverNoteValue : undefined,
  });

  return created(await applyToJob({ jobId, candidateId: candidate._id, coverNote, file }));
});
