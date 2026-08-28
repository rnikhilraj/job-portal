import { NextResponse } from 'next/server';

import { BadRequestError } from '@/lib/api/errors';
import { ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';
import {
  assertContentLengthWithinLimit,
  readResume,
  resumeDownloadHeaders,
} from '@/lib/resume-storage';
import { enforceRateLimit, userKey } from '@/lib/rate-limit';
import { requireUser } from '@/modules/auth/session';
import {
  findOwnResume,
  removeOwnResume,
  replaceOwnResume,
} from '@/modules/users/user.service';

/**
 * GET /api/users/me/resume — the caller's own general resume.
 *
 * Not gated on isSearchable: that flag governs what recruiters may see, not
 * whether someone can read back a file they uploaded themselves. Recruiter
 * access goes through /api/candidates/:id/resume instead.
 */
export const GET = withRoute(async (request) => {
  const user = await requireUser(request);
  const resume = await findOwnResume(String(user._id));
  const file = await readResume(resume.storedName);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: resumeDownloadHeaders(resume.originalName, file.byteLength),
  });
});

/** PUT /api/users/me/resume — upload or replace the caller's general resume. */
export const PUT = withRoute(async (request) => {
  const user = await requireUser(request);

  // Same reasoning as the application upload: a disk write behind a verified
  // session, so the bucket is the account. Replacing a resume is a rarer act
  // than applying to jobs, hence the tighter allowance.
  enforceRateLimit(userKey('profile-resume', String(user._id)), {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  // Checked before parsing so an oversized upload is never buffered into memory.
  assertContentLengthWithinLimit(request.headers.get('content-length'));

  const formData = await request.formData().catch(() => {
    throw new BadRequestError('Expected a multipart form submission.');
  });

  const file = formData.get('resume');
  if (!(file instanceof File)) {
    throw new BadRequestError('A PDF resume is required.');
  }

  // storeResume() performs the same validation as an application upload:
  // magic-byte check, size cap and a server-generated filename.
  return ok(await replaceOwnResume(String(user._id), file));
});

/** DELETE /api/users/me/resume — remove it. */
export const DELETE = withRoute(async (request) => {
  const user = await requireUser(request);
  return ok(await removeOwnResume(String(user._id)));
});
