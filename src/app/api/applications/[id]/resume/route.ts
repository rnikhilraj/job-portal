import { NextResponse } from 'next/server';

import { withRoute } from '@/lib/api/route';
import { objectIdSchema } from '@/lib/validation';
import { requireUser } from '@/modules/auth/session';
import { findResumeForViewer } from '@/modules/applications/application.service';
import { readResume } from '@/modules/applications/resume.storage';

/**
 * Encodes a filename for Content-Disposition. The value is already sanitised on
 * upload; quoting and percent-encoding it here closes off header injection for
 * good.
 */
function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * GET /api/applications/:id/resume — downloads the stored PDF.
 *
 * Readable only by the HR user who owns the listing or the candidate who
 * submitted it; findResumeForViewer raises 403 for anybody else. Files are
 * served through this handler rather than from a public directory precisely so
 * that check cannot be bypassed by guessing a URL.
 */
export const GET = withRoute<{ id: string }>(async (request, params) => {
  const applicationId = objectIdSchema.parse(params.id);
  const viewer = await requireUser(request);

  const { storedName, originalName } = await findResumeForViewer(applicationId, viewer);
  const file = await readResume(storedName);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(file.byteLength),
      'Content-Disposition': contentDisposition(originalName),
      // Resumes are personal data: never cached by a proxy, never sniffed into
      // another content type, never framed.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});
