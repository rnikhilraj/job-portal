import { NextResponse } from 'next/server';

import { withRoute } from '@/lib/api/route';
import { readResume, resumeDownloadHeaders } from '@/lib/resume-storage';
import { objectIdSchema } from '@/lib/validation';
import { requireRole } from '@/modules/auth/session';
import { findCandidateResumeForRecruiter } from '@/modules/users/user.service';

/**
 * GET /api/candidates/:id/resume — a candidate's general profile resume,
 * for recruiters.
 *
 * Two conditions, both evaluated per request: the caller must be HR, and the
 * candidate must currently have isSearchable set. Nothing is served from a
 * public path, so a URL saved while a candidate was discoverable starts
 * returning 403 the moment they opt out — the link is not a capability.
 *
 * This is distinct from /api/applications/:id/resume, which serves the resume
 * attached to a specific application and is governed by listing ownership.
 */
export const GET = withRoute<{ id: string }>(async (request, params) => {
  const candidateId = objectIdSchema.parse(params.id);
  await requireRole(request, 'HR');

  const resume = await findCandidateResumeForRecruiter(candidateId);
  const file = await readResume(resume.storedName);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: resumeDownloadHeaders(resume.originalName, file.byteLength),
  });
});
