import { NextResponse } from 'next/server';

import { withRoute } from '@/lib/api/route';
import { readResume, resumeDownloadHeaders } from '@/lib/resume-storage';
import { objectIdSchema } from '@/lib/validation';
import { findResumeForViewer } from '@/modules/applications/application.service';
import { requireUser } from '@/modules/auth/session';

/**
 * GET /api/applications/:id/resume — downloads the resume sent with one
 * application.
 *
 * Readable only by the HR user who owns the listing or the candidate who
 * submitted it; findResumeForViewer raises 403 for anybody else. This is
 * separate from a candidate's general profile resume, which is governed by the
 * isSearchable opt-in — see /api/candidates/:id/resume. Files are served
 * through a handler rather than from a public directory precisely so these
 * checks cannot be bypassed by guessing a URL.
 */
export const GET = withRoute<{ id: string }>(async (request, params) => {
  const applicationId = objectIdSchema.parse(params.id);
  const viewer = await requireUser(request);

  const { storedName, originalName } = await findResumeForViewer(applicationId, viewer);
  const file = await readResume(storedName);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: resumeDownloadHeaders(originalName, file.byteLength),
  });
});
